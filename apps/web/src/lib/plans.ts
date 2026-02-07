export type FeatureKey = "portal" | "shopify" | "notifications" | "csvImport" | "demoMode";
export type PlanTier = "STARTER" | "PRO" | "AGENCY" | "ENTERPRISE";

export type PlanDefinition = {
  seatLimit: number;
  skuLimit: number;
  competitorLimit: number;
  monthlySnapshotImportLimit: number;
  features: Record<FeatureKey, boolean>;
};

export const PLAN_DEFS: Record<PlanTier, PlanDefinition> = {
  STARTER: {
    seatLimit: 2,
    skuLimit: 200,
    competitorLimit: 5,
    monthlySnapshotImportLimit: 5000,
    features: {
      portal: false,
      shopify: false,
      notifications: false,
      csvImport: true,
      demoMode: true,
    },
  },
  PRO: {
    seatLimit: 5,
    skuLimit: 1000,
    competitorLimit: 15,
    monthlySnapshotImportLimit: 50000,
    features: {
      portal: true,
      shopify: true,
      notifications: true,
      csvImport: true,
      demoMode: true,
    },
  },
  AGENCY: {
    seatLimit: 20,
    skuLimit: 5000,
    competitorLimit: 50,
    monthlySnapshotImportLimit: 250000,
    features: {
      portal: true,
      shopify: true,
      notifications: true,
      csvImport: true,
      demoMode: true,
    },
  },
  ENTERPRISE: {
    seatLimit: 999,
    skuLimit: 999999,
    competitorLimit: 999,
    monthlySnapshotImportLimit: 9999999,
    features: {
      portal: true,
      shopify: true,
      notifications: true,
      csvImport: true,
      demoMode: true,
    },
  },
};

export const PLAN_TIERS = Object.keys(PLAN_DEFS) as PlanTier[];

export function isPlanTier(value: string): value is PlanTier {
  return PLAN_TIERS.includes(value as PlanTier);
}

export function ensureWorkspaceSubscription(workspaceId: string) {
  return prisma.workspaceSubscription.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      plan: "STARTER",
    },
    update: {},
  });
}
import { prisma } from "@/lib/prisma";
