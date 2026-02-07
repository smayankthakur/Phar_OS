import type { Prisma } from "@pharos/db";
import type { RoundingMode } from "@pharos/core";
import { prisma } from "@/lib/prisma";

export const DEFAULT_PRICING_SETTINGS = {
  minMarginPercent: 10,
  maxPriceChangePercent: 15,
  roundingMode: "NEAREST_1" as RoundingMode,
};

export function parseRoundingMode(value: string): RoundingMode {
  if (value === "NONE" || value === "NEAREST_1" || value === "NEAREST_5" || value === "NEAREST_10") {
    return value;
  }
  return "NEAREST_1";
}

export async function ensureWorkspaceSettings(workspaceId: string) {
  return prisma.workspaceSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      minMarginPercent: DEFAULT_PRICING_SETTINGS.minMarginPercent,
      maxPriceChangePercent: DEFAULT_PRICING_SETTINGS.maxPriceChangePercent,
      roundingMode: DEFAULT_PRICING_SETTINGS.roundingMode,
    },
    update: {},
  });
}

export function normalizePricingSettings(settings: {
  minMarginPercent: Prisma.Decimal;
  maxPriceChangePercent: Prisma.Decimal;
  roundingMode: string;
}) {
  return {
    minMarginPercent: settings.minMarginPercent.toNumber(),
    maxPriceChangePercent: settings.maxPriceChangePercent.toNumber(),
    roundingMode: parseRoundingMode(settings.roundingMode),
  };
}

export async function getPricingSettings(workspaceId: string) {
  const settings = await ensureWorkspaceSettings(workspaceId);
  return normalizePricingSettings(settings);
}
