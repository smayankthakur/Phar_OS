import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { PLAN_TIERS, type PlanTier } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/rbac";
import { appUrl, getStripe, priceIdForPlan } from "@/lib/stripe";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace } from "@/lib/tenant";

const schema = z.object({
  plan: z.enum(PLAN_TIERS as [PlanTier, ...PlanTier[]]),
});

export async function POST(request: Request) {
  const { workspace } = await getCurrentWorkspace();

  try {
    await requireOwner(workspace.id);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize checkout", 500);
  }

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid checkout payload", 400);
  }

  try {
    const stripe = getStripe();
    const subscription = await prisma.workspaceSubscription.upsert({
      where: { workspaceId: workspace.id },
      create: {
        workspaceId: workspace.id,
        plan: "STARTER",
        status: "TRIALING",
      },
      update: {},
    });

    let customerId = subscription.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: workspace.name,
        metadata: {
          workspaceId: workspace.id,
        },
      });
      customerId = customer.id;
      await prisma.workspaceSubscription.update({
        where: { workspaceId: workspace.id },
        data: {
          stripeCustomerId: customerId,
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceIdForPlan(payload.plan),
          quantity: 1,
        },
      ],
      success_url: `${appUrl()}/billing?checkout=success`,
      cancel_url: `${appUrl()}/billing?checkout=cancel`,
      metadata: {
        workspaceId: workspace.id,
        requestedPlan: payload.plan,
      },
      subscription_data: {
        metadata: {
          workspaceId: workspace.id,
          requestedPlan: payload.plan,
        },
      },
      allow_promotion_codes: true,
    });

    await logTelemetry(prisma, workspace.id, "STRIPE_CHECKOUT_CREATED", {
      plan: payload.plan,
      checkoutSessionId: session.id,
    });

    if (!session.url) {
      return err("INTERNAL", "Stripe checkout URL missing", 500);
    }

    return ok({ url: session.url });
  } catch (error) {
    return err("INTERNAL", error instanceof Error ? error.message : "Failed to create checkout session", 500);
  }
}
