import { ok } from "@/lib/apiResponse";
import { getWorkspacePlan } from "@/lib/entitlements";
import { getCurrentWorkspace } from "@/lib/tenant";

export async function GET() {
  const { workspace } = await getCurrentWorkspace();
  const plan = await getWorkspacePlan(workspace.id);

  return ok({
    workspace: {
      id: workspace.id,
      name: workspace.name,
    },
    subscription: {
      plan: plan.plan,
      status: plan.status,
      stripeCustomerId: plan.stripeCustomerId ?? null,
      stripeSubscriptionId: plan.stripeSubscriptionId ?? null,
      currentPeriodEnd: plan.currentPeriodEnd ? plan.currentPeriodEnd.toISOString() : null,
      cancelAtPeriodEnd: plan.cancelAtPeriodEnd,
    },
    limits: {
      seatLimit: plan.limits.seatLimit,
      skuLimit: plan.limits.skuLimit,
      competitorLimit: plan.limits.competitorLimit,
      monthlySnapshotImportLimit: plan.limits.monthlySnapshotImportLimit,
    },
    usage: plan.usage,
    features: plan.limits.features,
  });
}
