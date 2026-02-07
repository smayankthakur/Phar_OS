import { createHash } from "node:crypto";
import Stripe from "stripe";
import { Prisma } from "@pharos/db";
import { prisma } from "@/lib/prisma";
import { RateLimitError, getClientIp, rateLimitOrThrow } from "@/lib/ratelimit";
import { getStripe, planForPriceId, toBillingStatus } from "@/lib/stripe";
import { logTelemetry } from "@/lib/telemetry";

export const runtime = "nodejs";

function periodEndToDate(unix: number | null | undefined) {
  if (!unix) return null;
  return new Date(unix * 1000);
}

async function resolveWorkspaceSubscription(args: {
  customerId?: string | null;
  subscriptionId?: string | null;
  workspaceId?: string | null;
}) {
  const { customerId, subscriptionId, workspaceId } = args;

  if (workspaceId) {
    const existing = await prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
    });
    if (existing) return existing;
  }

  if (customerId) {
    const existing = await prisma.workspaceSubscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (existing) return existing;
  }

  if (subscriptionId) {
    const existing = await prisma.workspaceSubscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });
    if (existing) return existing;
  }

  return null;
}

async function syncFromStripeSubscription(stripeSubscription: Stripe.Subscription, workspaceIdFromMetadata?: string | null) {
  const customerId = typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : stripeSubscription.customer.id;
  const subscriptionId = stripeSubscription.id;

  const existing = await resolveWorkspaceSubscription({
    customerId,
    subscriptionId,
    workspaceId: workspaceIdFromMetadata ?? stripeSubscription.metadata?.workspaceId ?? null,
  });

  if (!existing) {
    return;
  }

  const priceId = stripeSubscription.items.data[0]?.price?.id;
  const mappedPlan = priceId ? planForPriceId(priceId) : null;
  const nextStatus = toBillingStatus(stripeSubscription.status);
  const previousStatus = existing.status;
  const subscriptionAny = stripeSubscription as unknown as { current_period_end?: number };

  await prisma.workspaceSubscription.update({
    where: { workspaceId: existing.workspaceId },
    data: {
      plan: mappedPlan ?? existing.plan,
      status: nextStatus,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      currentPeriodEnd: periodEndToDate(subscriptionAny.current_period_end),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      renewedAt: new Date(),
    },
  });

  if (previousStatus !== nextStatus) {
    await logTelemetry(prisma, existing.workspaceId, "BILLING_STATUS_CHANGED", {
      from: previousStatus,
      to: nextStatus,
      stripeSubscriptionId: subscriptionId,
    });
  }
}

async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const workspaceId = session.metadata?.workspaceId ?? null;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  const existing = await resolveWorkspaceSubscription({ workspaceId, customerId, subscriptionId });
  if (!existing) return;

  // Do not override subscription "truth" if it has already been synced by a subscription.updated event.
  const checkoutData: Record<string, unknown> = { renewedAt: new Date() };
  if (!existing.stripeCustomerId && customerId) checkoutData.stripeCustomerId = customerId;
  if (!existing.stripeSubscriptionId && subscriptionId) checkoutData.stripeSubscriptionId = subscriptionId;
  await prisma.workspaceSubscription.update({ where: { workspaceId: existing.workspaceId }, data: checkoutData });

  if (subscriptionId) {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncFromStripeSubscription(subscription, existing.workspaceId);
  }
}

async function handleInvoiceEvent(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const invoiceAny = invoice as unknown as { subscription?: string | null };
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const subscriptionId = invoiceAny.subscription ?? null;

  const existing = await resolveWorkspaceSubscription({ customerId, subscriptionId });
  if (!existing) return;

  if (event.type === "invoice.payment_failed") {
    if (existing.status !== "PAST_DUE") {
      await prisma.workspaceSubscription.update({
        where: { workspaceId: existing.workspaceId },
        data: { status: "PAST_DUE" },
      });
      await logTelemetry(prisma, existing.workspaceId, "BILLING_STATUS_CHANGED", {
        from: existing.status,
        to: "PAST_DUE",
        invoiceId: invoice.id,
      });
    }
  }

  if (event.type === "invoice.payment_succeeded") {
    if (subscriptionId) {
      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncFromStripeSubscription(subscription, existing.workspaceId);
      return;
    }

    if (existing.status === "PAST_DUE") {
      await prisma.workspaceSubscription.update({
        where: { workspaceId: existing.workspaceId },
        data: { status: "ACTIVE" },
      });
      await logTelemetry(prisma, existing.workspaceId, "BILLING_STATUS_CHANGED", {
        from: "PAST_DUE",
        to: "ACTIVE",
        invoiceId: invoice.id,
      });
    }
  }
}

async function processEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    await handleCheckoutCompleted(event);
    return;
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await syncFromStripeSubscription(event.data.object as Stripe.Subscription);
    return;
  }

  if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
    await handleInvoiceEvent(event);
  }
}

export async function POST(request: Request) {
  try {
    await rateLimitOrThrow({
      route: "stripe.webhook",
      scopeKey: `ip:${getClientIp(request)}`,
      limit: 60,
      windowSec: 60,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return new Response("Too many requests", { status: 429 });
    }
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const rawBody = await request.text();
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // Idempotent + retryable storage:
  // - If processing fails, processedAt remains null, allowing retries.
  // - If already processed, return 200.
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (existing?.processedAt) {
    return new Response("Already processed", { status: 200 });
  }

  try {
    if (existing) {
      await prisma.stripeWebhookEvent.update({
        where: { stripeEventId: event.id },
        data: {
          type: event.type,
          payloadHash,
        },
      });
    } else {
      await prisma.stripeWebhookEvent.create({
        data: {
          stripeEventId: event.id,
          type: event.type,
          payloadHash,
          processedAt: null,
        },
      });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.stripeWebhookEvent.findUnique({ where: { stripeEventId: event.id } });
      if (raced?.processedAt) return new Response("Already processed", { status: 200 });
    }
    return new Response("Webhook storage failure", { status: 500 });
  }

  try {
    await processEvent(event);
  } catch {
    return new Response("Webhook processing failure", { status: 500 });
  }

  await prisma.stripeWebhookEvent.update({
    where: { stripeEventId: event.id },
    data: { processedAt: new Date() },
  }).catch(() => undefined);

  const sub = await resolveWorkspaceSubscription({
    customerId: (event.data.object as { customer?: string | null })?.customer ?? null,
    subscriptionId: (event.data.object as { id?: string; subscription?: string | null })?.subscription ?? (event.data.object as { id?: string })?.id ?? null,
    workspaceId: (event.data.object as { metadata?: Record<string, string> })?.metadata?.workspaceId ?? null,
  });

  if (sub) {
    await logTelemetry(prisma, sub.workspaceId, "STRIPE_WEBHOOK_PROCESSED", {
      type: event.type,
      eventId: event.id,
    });
  }

  return new Response("ok", { status: 200 });
}
