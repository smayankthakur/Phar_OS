import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/rbac";
import { appUrl, getStripe } from "@/lib/stripe";
import { getCurrentWorkspace } from "@/lib/tenant";

export async function POST(request: Request) {
  try {
    await verifyCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
  }

  const { workspace } = await getCurrentWorkspace();

  try {
    await requireOwner(workspace.id);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize billing portal", 500);
  }

  const subscription = await prisma.workspaceSubscription.findUnique({
    where: { workspaceId: workspace.id },
    select: { stripeCustomerId: true },
  });

  if (!subscription?.stripeCustomerId) {
    return err("BAD_REQUEST", "Stripe customer not initialized for this workspace", 400);
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${appUrl()}/billing`,
    });

    return ok({ url: session.url });
  } catch (error) {
    return err("INTERNAL", error instanceof Error ? error.message : "Failed to create billing portal session", 500);
  }
}
