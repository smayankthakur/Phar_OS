import { eventTypeSchema, type EventType } from "@pharos/core";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/tenant";
import { toEventDTO } from "@/lib/events";
import { err, ok } from "@/lib/apiResponse";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { EntitlementError, requireFeature } from "@/lib/entitlements";
import { createEventAndRecommendations, RuleRunnerError } from "@/lib/ruleRunner";
import { logTelemetry } from "@/lib/telemetry";

const simulateSchema = z.object({
  type: eventTypeSchema,
});

async function resolveDemoSku(workspaceId: string) {
  const demoSku = await prisma.sKU.findFirst({
    where: {
      workspaceId,
      sku: "DEMO-SKU-001",
    },
  });

  if (demoSku) return demoSku;

  const latest = await prisma.sKU.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });

  if (latest) return latest;

  return prisma.sKU.create({
    data: {
      workspaceId,
      title: "Demo SKU",
      sku: "DEMO-SKU-001",
      cost: 100,
      currentPrice: 120,
      status: "ACTIVE",
    },
  });
}

async function buildSimulationPayload(workspaceId: string, type: EventType) {
  const sku = await resolveDemoSku(workspaceId);

  if (type === "COMPETITOR_PRICE_DROP") {
    let competitor = await prisma.competitor.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    });

    if (!competitor) {
      competitor = await prisma.competitor.create({
        data: {
          workspaceId,
          name: "Demo Competitor",
          domain: "demo-competitor.local",
          currency: "INR",
        },
      });
    }

    const oldPrice = Number(sku.currentPrice) + 10;
    const newPrice = Math.max(Number(sku.currentPrice) - 5, 0.01);

    await prisma.competitorSnapshot.create({
      data: {
        workspaceId,
        skuId: sku.id,
        competitorId: competitor.id,
        price: oldPrice,
        source: "MANUAL",
      },
    });

    return {
      sku,
      payload: {
        skuId: sku.id,
        competitorId: competitor.id,
        oldPrice,
        newPrice,
        capturedAt: new Date().toISOString(),
      },
    };
  }

  if (type === "COST_INCREASE") {
    const oldCost = Number(sku.cost);
    const newCost = oldCost + 8;
    return {
      sku,
      payload: {
        skuId: sku.id,
        oldCost,
        newCost,
        reason: "Supplier adjustment",
      },
    };
  }

  return {
    sku,
    payload: {
      skuId: sku.id,
      available: 3,
      threshold: 10,
    },
  };
}

export async function POST(request: Request) {
  try {
    await verifyCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
  }

  const { workspace } = await getCurrentWorkspace();
  try {
    await requireFeature(workspace.id, "demoMode");
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    return err("INTERNAL", "Failed to resolve demo entitlement", 500);
  }

  let payload: z.infer<typeof simulateSchema>;
  try {
    payload = simulateSchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid simulation request", 400);
  }

  const built = await buildSimulationPayload(workspace.id, payload.type);

  try {
    const result = await createEventAndRecommendations({
      type: payload.type,
      payload: built.payload,
      skuId: built.sku.id,
    });
    await logTelemetry(prisma, workspace.id, "SIMULATION_RUN", {
      simulationType: payload.type,
      skuId: built.sku.id,
      actionsCreated: result.actions.length,
    });

    return ok({
      event: toEventDTO(result.event),
      actions: result.actions.map((action) => ({
        id: action.id,
        type: action.type,
        title: action.title,
        status: action.status,
      })),
    });
  } catch (error) {
    if (error instanceof RuleRunnerError) {
      if (error.status === 404) return err("NOT_FOUND", error.message, 404);
      if (error.status === 409) return err("CONFLICT", error.message, 409);
      return err("BAD_REQUEST", error.message, 400);
    }
    return err("BAD_REQUEST", error instanceof Error ? error.message : "Simulation failed", 400);
  }
}
