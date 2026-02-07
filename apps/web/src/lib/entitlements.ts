import { prisma } from "@/lib/prisma";
import { PLAN_DEFS, type FeatureKey, type PlanTier } from "@/lib/plans";
import { currentYearMonth, getOrCreateUsage, recalcUsage } from "@/lib/usage";
import { logTelemetry } from "@/lib/telemetry";

export type LimitKey = "seats" | "skus" | "competitors" | "snapshotRows" | "portalTokens";

export class EntitlementError extends Error {
  constructor(
    public code: "FEATURE_LOCKED" | "LIMIT_EXCEEDED",
    message: string,
    public status = 403,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type WorkspacePlanInfo = {
  plan: PlanTier;
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  limits: (typeof PLAN_DEFS)[PlanTier];
  usage: {
    yearMonth: string;
    seatsUsed: number;
    skusUsed: number;
    competitorsUsed: number;
    snapshotImportRowsUsed: number;
    portalTokensUsed: number;
  };
};

export async function getWorkspacePlan(workspaceId: string): Promise<WorkspacePlanInfo> {
  const [subscription, workspace] = await Promise.all([
    prisma.workspaceSubscription.upsert({
    where: { workspaceId },
    create: { workspaceId, plan: "STARTER", status: "TRIALING" },
    update: {},
  }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { planOverride: true, billingManagedByReseller: true },
    }),
  ]);

  const yearMonth = currentYearMonth();
  const usage = await recalcUsage(workspaceId, yearMonth);
  const effectivePlan = (workspace?.planOverride ?? subscription.plan) as PlanTier;
  const effectiveStatus: WorkspacePlanInfo["status"] = workspace?.billingManagedByReseller
    ? "ACTIVE"
    : ((subscription.status as WorkspacePlanInfo["status"]) ?? "TRIALING");

  return {
    plan: effectivePlan,
    status: effectiveStatus,
    stripeCustomerId: subscription.stripeCustomerId ?? null,
    stripeSubscriptionId: subscription.stripeSubscriptionId ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    limits: PLAN_DEFS[effectivePlan],
    usage: {
      yearMonth: usage.yearMonth,
      seatsUsed: usage.seatsUsed,
      skusUsed: usage.skusUsed,
      competitorsUsed: usage.competitorsUsed,
      snapshotImportRowsUsed: usage.snapshotImportRowsUsed,
      portalTokensUsed: usage.portalTokensUsed,
    },
  };
}

function limitValue(info: WorkspacePlanInfo, key: LimitKey) {
  if (key === "seats") return { current: info.usage.seatsUsed, limit: info.limits.seatLimit };
  if (key === "skus") return { current: info.usage.skusUsed, limit: info.limits.skuLimit };
  if (key === "competitors") return { current: info.usage.competitorsUsed, limit: info.limits.competitorLimit };
  if (key === "portalTokens") return { current: info.usage.portalTokensUsed, limit: info.limits.seatLimit };
  return { current: info.usage.snapshotImportRowsUsed, limit: info.limits.monthlySnapshotImportLimit };
}

export async function requireFeature(workspaceId: string, feature: FeatureKey) {
  const info = await getWorkspacePlan(workspaceId);
  if (!info.limits.features[feature]) {
    await logTelemetry(prisma, workspaceId, "LIMIT_BLOCKED", {
      type: `feature:${feature}`,
      current: 0,
      limit: 0,
      plan: info.plan,
    });

    throw new EntitlementError(
      "FEATURE_LOCKED",
      `Feature '${feature}' is not available on ${info.plan}. Upgrade required.`,
      403,
      {
        feature,
        plan: info.plan,
      },
    );
  }
  return info;
}

export async function requireBillingWriteAccess(workspaceId: string, reason: string) {
  const info = await getWorkspacePlan(workspaceId);
  if (info.status === "PAST_DUE" || info.status === "CANCELED") {
    await logTelemetry(prisma, workspaceId, "LIMIT_BLOCKED", {
      type: `billing_status:${info.status}`,
      current: 0,
      limit: 0,
      reason,
      plan: info.plan,
    });
    throw new EntitlementError(
      "FEATURE_LOCKED",
      `Billing status ${info.status} blocks this operation. Update billing to continue.`,
      403,
      { reason, status: info.status, plan: info.plan },
    );
  }
  return info;
}

export async function requireWithinLimit(workspaceId: string, key: LimitKey, nextCountDelta = 1) {
  const [subscription, workspace] = await Promise.all([
    prisma.workspaceSubscription.upsert({
      where: { workspaceId },
      create: { workspaceId, plan: "STARTER", status: "TRIALING" },
      update: {},
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { planOverride: true, billingManagedByReseller: true },
    }),
  ]);
  const plan = ((workspace?.planOverride ?? subscription.plan) as PlanTier) ?? "STARTER";

  const yearMonth = currentYearMonth();
  const usage = key === "snapshotRows" ? await getOrCreateUsage(workspaceId, yearMonth) : await recalcUsage(workspaceId, yearMonth);
  const info: WorkspacePlanInfo = {
    plan,
    status: workspace?.billingManagedByReseller ? "ACTIVE" : ((subscription.status as WorkspacePlanInfo["status"]) ?? "TRIALING"),
    stripeCustomerId: subscription.stripeCustomerId ?? null,
    stripeSubscriptionId: subscription.stripeSubscriptionId ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    limits: PLAN_DEFS[plan],
    usage: {
      yearMonth,
      seatsUsed: usage.seatsUsed,
      skusUsed: usage.skusUsed,
      competitorsUsed: usage.competitorsUsed,
      snapshotImportRowsUsed: usage.snapshotImportRowsUsed,
      portalTokensUsed: usage.portalTokensUsed,
    },
  };

  const { current, limit } = limitValue(info, key);
  if (current + nextCountDelta > limit) {
    await logTelemetry(prisma, workspaceId, "LIMIT_BLOCKED", {
      type: key,
      current,
      limit,
      delta: nextCountDelta,
      plan,
    });

    throw new EntitlementError(
      "LIMIT_EXCEEDED",
      `Limit exceeded for ${key}. ${current}/${limit} used.`,
      403,
      {
        key,
        current,
        limit,
        delta: nextCountDelta,
        plan,
      },
    );
  }

  return info;
}
