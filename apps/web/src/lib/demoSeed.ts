import { Prisma } from "@pharos/db";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PRICING_SETTINGS } from "@/lib/settings";

export const DEMO_SKUS = [
  { code: "DEMO-SKU-001", title: "Demo SKU 001", cost: 100, currentPrice: 120 },
  { code: "DEMO-SKU-002", title: "Demo SKU 002", cost: 250, currentPrice: 299 },
  { code: "DEMO-SKU-003", title: "Demo SKU 003", cost: 500, currentPrice: 649 },
] as const;

export const DEMO_COMPETITORS = [
  { name: "DemoMart", domain: "demomart.test" },
  { name: "PriceKing", domain: "priceking.test" },
  { name: "ValueHub", domain: "valuehub.test" },
] as const;

const COMPETITOR_OFFSETS: Record<string, number> = {
  DemoMart: -5,
  PriceKing: 3,
  ValueHub: -1,
};

const DEFAULT_RULES = [
  {
    name: "Rule A - Competitor Price Drop -> Price Match",
    eventType: "COMPETITOR_PRICE_DROP",
    enabled: true,
    condition: {
      op: "lt",
      left: "payload.newPrice",
      right: "sku.currentPrice",
    },
    actionTemplate: {
      type: "PRICE_MATCH",
      params: {},
    },
  },
  {
    name: "Rule B - Cost Increase -> Price Increase",
    eventType: "COST_INCREASE",
    enabled: true,
    condition: {
      op: "gt",
      left: "payload.newCost",
      right: "payload.oldCost",
    },
    actionTemplate: {
      type: "PRICE_INCREASE",
      params: {},
    },
  },
  {
    name: "Rule C - Stock Low -> Notify",
    eventType: "STOCK_LOW",
    enabled: true,
    condition: {
      op: "lt",
      left: "payload.available",
      right: "payload.threshold",
    },
    actionTemplate: {
      type: "NOTIFY",
      params: {},
    },
  },
] as const;

export async function resetWorkspaceDemoDataset(workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({ where: { workspaceId } });
    await tx.notificationOutbox.deleteMany({ where: { workspaceId } });
    await tx.action.deleteMany({ where: { workspaceId } });
    await tx.event.deleteMany({ where: { workspaceId } });
    await tx.competitorSnapshot.deleteMany({ where: { workspaceId } });
    await tx.rule.deleteMany({ where: { workspaceId } });
    await tx.competitor.deleteMany({ where: { workspaceId } });
    await tx.sKU.deleteMany({ where: { workspaceId } });

    await tx.workspaceSettings.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        minMarginPercent: DEFAULT_PRICING_SETTINGS.minMarginPercent,
        maxPriceChangePercent: DEFAULT_PRICING_SETTINGS.maxPriceChangePercent,
        roundingMode: DEFAULT_PRICING_SETTINGS.roundingMode,
      },
      update: {
        minMarginPercent: DEFAULT_PRICING_SETTINGS.minMarginPercent,
        maxPriceChangePercent: DEFAULT_PRICING_SETTINGS.maxPriceChangePercent,
        roundingMode: DEFAULT_PRICING_SETTINGS.roundingMode,
      },
    });

    const skus = await Promise.all(
      DEMO_SKUS.map((sku) =>
        tx.sKU.create({
          data: {
            workspaceId,
            title: sku.title,
            sku: sku.code,
            cost: sku.cost,
            currentPrice: sku.currentPrice,
            status: "ACTIVE",
          },
        }),
      ),
    );

    const competitors = await Promise.all(
      DEMO_COMPETITORS.map((competitor) =>
        tx.competitor.create({
          data: {
            workspaceId,
            name: competitor.name,
            domain: competitor.domain,
            currency: "INR",
          },
        }),
      ),
    );

    const snapshotsData: Prisma.CompetitorSnapshotCreateManyInput[] = [];
    for (const sku of skus) {
      const ourPrice = sku.currentPrice.toNumber();
      for (const competitor of competitors) {
        const offset = COMPETITOR_OFFSETS[competitor.name] ?? 0;
        const seededPrice = Math.max(ourPrice + offset, 0.01);
        snapshotsData.push({
          workspaceId,
          skuId: sku.id,
          competitorId: competitor.id,
          price: seededPrice,
          source: "MANUAL",
        });
      }
    }

    const snapshotsResult = await tx.competitorSnapshot.createMany({
      data: snapshotsData,
    });

    const rules = await Promise.all(
      DEFAULT_RULES.map((rule) =>
        tx.rule.create({
          data: {
            workspaceId,
            name: rule.name,
            eventType: rule.eventType,
            enabled: rule.enabled,
            condition: rule.condition,
            actionTemplate: rule.actionTemplate,
          },
        }),
      ),
    );

    return {
      skusCount: skus.length,
      competitorsCount: competitors.length,
      snapshotsCount: snapshotsResult.count,
      rulesCount: rules.length,
    };
  });
}
