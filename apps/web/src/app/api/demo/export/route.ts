import { ok, err } from "@/lib/apiResponse";
import { EntitlementError, requireFeature } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { ensureWorkspaceSettings, normalizePricingSettings } from "@/lib/settings";
import { getCurrentWorkspace } from "@/lib/tenant";

export async function GET() {
  try {
    const { workspace } = await getCurrentWorkspace();
    await requireFeature(workspace.id, "demoMode");

    const [settingsRaw, skus, competitors, rules, snapshots] = await Promise.all([
      ensureWorkspaceSettings(workspace.id),
      prisma.sKU.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.competitor.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.rule.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.competitorSnapshot.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { capturedAt: "desc" },
        take: 5000,
      }),
    ]);

    const payload = {
      ok: true,
      exportedAt: new Date().toISOString(),
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
      settings: normalizePricingSettings(settingsRaw),
      skus: skus.map((sku) => ({
        id: sku.id,
        title: sku.title,
        sku: sku.sku,
        cost: sku.cost.toNumber(),
        currentPrice: sku.currentPrice.toNumber(),
        status: sku.status,
        createdAt: sku.createdAt.toISOString(),
        updatedAt: sku.updatedAt.toISOString(),
      })),
      competitors: competitors.map((competitor) => ({
        id: competitor.id,
        name: competitor.name,
        domain: competitor.domain,
        currency: competitor.currency,
      })),
      rules: rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        eventType: rule.eventType,
        enabled: rule.enabled,
        condition: rule.condition,
        actionTemplate: rule.actionTemplate,
      })),
      snapshots: snapshots.map((snapshot) => ({
        id: snapshot.id,
        skuId: snapshot.skuId,
        competitorId: snapshot.competitorId,
        price: snapshot.price.toNumber(),
        capturedAt: snapshot.capturedAt.toISOString(),
        source: snapshot.source,
      })),
    };

    const filename = `pharos-demo-export-${new Date().toISOString().slice(0, 10)}.json`;
    const response = ok(payload);
    response.headers.set("Content-Type", "application/json");
    response.headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    return response;
  } catch (error) {
    if (error instanceof EntitlementError) {
      return err("FORBIDDEN", error.message, 403);
    }
    return err("INTERNAL", error instanceof Error ? error.message : "Failed to export dataset", 500);
  }
}
