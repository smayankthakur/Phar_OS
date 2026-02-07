import { enforceGuardrails } from "@pharos/core";
import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { EntitlementError, requireBillingWriteAccess, requireFeature } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/rbac";
import { getPricingSettings } from "@/lib/settings";
import { getShopifySettings } from "@/lib/shopifyClient";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace } from "@/lib/tenant";

const queueSchema = z.object({
  skuId: z.string().min(1),
  actionId: z.string().min(1).optional(),
  newPrice: z.number().positive(),
});

const listSchema = z.object({
  status: z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

function parseActionSuggestedPrice(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const data = details as Record<string, unknown>;
  const final = data.suggestedPriceFinal;
  const fallback = data.suggestedPrice;
  const value = typeof final === "number" ? final : fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

export async function GET(request: Request) {
  const { workspace } = await getCurrentWorkspace();
  try {
    await requireFeature(workspace.id, "shopify");
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    return err("INTERNAL", "Failed to resolve Shopify entitlement", 500);
  }
  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return err("BAD_REQUEST", "Invalid query params", 400);
  }

  const jobs = await prisma.shopifyJob.findMany({
    where: {
      workspaceId: workspace.id,
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: parsed.data.limit,
    include: {
      sku: {
        select: {
          id: true,
          sku: true,
          title: true,
          shopifyVariantId: true,
        },
      },
      action: {
        select: {
          id: true,
          type: true,
          status: true,
        },
      },
    },
  });

  return ok({
    items: jobs.map((job) => ({
      id: job.id,
      workspaceId: job.workspaceId,
      skuId: job.skuId,
      actionId: job.actionId,
      type: job.type,
      payload: job.payload,
      status: job.status,
      attempts: job.attempts,
      lastError: job.lastError,
      result: job.result,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      sku: job.sku,
      action: job.action,
    })),
  });
}

export async function POST(request: Request) {
  try {
    await verifyCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
  }

  const { workspace } = await getCurrentWorkspace();
  try {
    await requireOwner(workspace.id);
    await requireFeature(workspace.id, "shopify");
    await requireBillingWriteAccess(workspace.id, "shopify_push");
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize Shopify push", 500);
  }

  let payload: z.infer<typeof queueSchema>;
  try {
    payload = queueSchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid Shopify job payload", 400);
  }

  const sku = await prisma.sKU.findFirst({
    where: {
      id: payload.skuId,
      workspaceId: workspace.id,
    },
    select: {
      id: true,
      cost: true,
      currentPrice: true,
      shopifyVariantId: true,
      shopifyProductId: true,
      sku: true,
      title: true,
    },
  });

  if (!sku) {
    return err("NOT_FOUND", "SKU not found", 404);
  }

  if (!sku.shopifyVariantId) {
    return err("BAD_REQUEST", "SKU is missing shopifyVariantId mapping", 400);
  }

  let action: { id: string; status: string; type: string; details: unknown } | null = null;
  if (payload.actionId) {
    action = await prisma.action.findFirst({
      where: {
        id: payload.actionId,
        workspaceId: workspace.id,
      },
      select: {
        id: true,
        status: true,
        type: true,
        details: true,
      },
    });

    if (!action) return err("NOT_FOUND", "Action not found", 404);
    if (action.status !== "APPLIED") {
      return err("BAD_REQUEST", "Action must be APPLIED before Shopify push", 400);
    }

    if (action.type !== "PRICE_MATCH" && action.type !== "PRICE_INCREASE") {
      return err("BAD_REQUEST", "Only price-changing actions can be pushed to Shopify", 400);
    }
  }

  const suggestedPrice = payload.newPrice;
  const pricingSettings = await getPricingSettings(workspace.id);
  const guardrail = enforceGuardrails({
    cost: sku.cost.toNumber(),
    currentPrice: sku.currentPrice.toNumber(),
    suggestedPrice,
    minMarginPct: pricingSettings.minMarginPercent,
    maxChangePct: pricingSettings.maxPriceChangePercent,
    roundingMode: pricingSettings.roundingMode,
  });

  if (guardrail.safetyStatus === "BLOCKED") {
    return err("CONFLICT", `Action blocked by guardrails: ${guardrail.safetyReason ?? "Unsafe price change"}`, 409);
  }

  if (action) {
    const actionSuggested = parseActionSuggestedPrice(action.details);
    if (actionSuggested !== null && Math.abs(actionSuggested - payload.newPrice) > 0.0001) {
      return err("BAD_REQUEST", "newPrice must match applied action suggested price", 400);
    }
  }

  const shopifySettings = await getShopifySettings(workspace.id);

  const job = await prisma.shopifyJob.create({
    data: {
      workspaceId: workspace.id,
      skuId: sku.id,
      actionId: action?.id ?? null,
      type: "UPDATE_VARIANT_PRICE",
      payload: {
        productId: sku.shopifyProductId,
        variantId: sku.shopifyVariantId,
        newPrice: guardrail.suggestedPriceFinal,
      },
      status: "QUEUED",
    },
  });

  await logTelemetry(prisma, workspace.id, "SHOPIFY_JOB_QUEUED", {
    jobId: job.id,
    skuId: sku.id,
    mode: shopifySettings.priceUpdateMode,
  });

  return ok(
    {
      item: {
        id: job.id,
        status: job.status,
        payload: job.payload,
        createdAt: job.createdAt.toISOString(),
      },
    },
    201,
  );
}
