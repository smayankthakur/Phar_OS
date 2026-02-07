import { enforceGuardrails } from "@pharos/core";
import { Prisma } from "@pharos/db";
import { prisma } from "@/lib/prisma";
import { getPricingSettings } from "@/lib/settings";
import {
  getShopifySettings,
  isShopifyConfigured,
  normalizeVariantGid,
  shopifyFetch,
} from "@/lib/shopifyClient";
import { logTelemetry } from "@/lib/telemetry";

const UPDATE_MUTATION = `
mutation productVariantUpdate($input: ProductVariantInput!) {
  productVariantUpdate(input: $input) {
    productVariant { id price }
    userErrors { field message }
  }
}
`;

function parsePayload(payload: Prisma.JsonValue) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const data = payload as Record<string, unknown>;
  const variantId = data.variantId;
  const newPrice = data.newPrice;
  if (typeof variantId !== "string") return null;
  if (typeof newPrice !== "number" || !Number.isFinite(newPrice) || newPrice <= 0) return null;
  return { variantId, newPrice };
}

async function claimShopifyJobs(workspaceId: string, limit: number) {
  const claimed = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      WITH cte AS (
        SELECT id
        FROM "ShopifyJob"
        WHERE "workspaceId" = ${workspaceId}
          AND status = 'QUEUED'
        ORDER BY "createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "ShopifyJob" j
      SET status = 'RUNNING',
          attempts = j.attempts + 1,
          "updatedAt" = NOW()
      FROM cte
      WHERE j.id = cte.id
      RETURNING j.id;
    `,
  );
  return claimed.map((row) => row.id);
}

export async function processShopifyJobs(workspaceId: string, limit: number) {
  const [shopifySettings, pricingSettings] = await Promise.all([
    getShopifySettings(workspaceId),
    getPricingSettings(workspaceId),
  ]);

  const claimedIds = await claimShopifyJobs(workspaceId, limit);
  if (claimedIds.length === 0) return [];

  const jobs = await prisma.shopifyJob.findMany({
    where: { workspaceId, id: { in: claimedIds } },
    include: {
      sku: {
        select: {
          id: true,
          cost: true,
          currentPrice: true,
          shopifyVariantId: true,
        },
      },
    },
  });

  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const orderedJobs = claimedIds.map((id) => jobsById.get(id)).filter(Boolean) as typeof jobs;

  const processed: Array<{ jobId: string; status: string; message?: string }> = [];

  for (const job of orderedJobs) {
    const parsedPayload = parsePayload(job.payload);
    if (!parsedPayload || !job.sku.shopifyVariantId) {
      await prisma.shopifyJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError: "Invalid job payload or SKU mapping",
          result: {
            dryRun: true,
            reason: "Invalid payload",
          } as Prisma.InputJsonValue,
        },
      });
      await logTelemetry(prisma, workspaceId, "SHOPIFY_JOB_PROCESSED", {
        jobId: job.id,
        status: "FAILED",
        dryRun: true,
      });
      processed.push({ jobId: job.id, status: "FAILED", message: "Invalid payload" });
      continue;
    }

    const guardrail = enforceGuardrails({
      cost: job.sku.cost.toNumber(),
      currentPrice: job.sku.currentPrice.toNumber(),
      suggestedPrice: parsedPayload.newPrice,
      minMarginPct: pricingSettings.minMarginPercent,
      maxChangePct: pricingSettings.maxPriceChangePercent,
      roundingMode: pricingSettings.roundingMode,
    });

    if (guardrail.safetyStatus === "BLOCKED") {
      await prisma.shopifyJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError: `Guardrail blocked push: ${guardrail.safetyReason ?? "Unsafe price change"}`,
          result: {
            dryRun: true,
            guardrailBlocked: true,
            safetyReason: guardrail.safetyReason ?? null,
          } as Prisma.InputJsonValue,
        },
      });
      await logTelemetry(prisma, workspaceId, "SHOPIFY_JOB_PROCESSED", {
        jobId: job.id,
        status: "FAILED",
        dryRun: true,
      });
      processed.push({ jobId: job.id, status: "FAILED", message: "Guardrail blocked" });
      continue;
    }

    const dryRun = shopifySettings.priceUpdateMode === "DRY_RUN" || !isShopifyConfigured(shopifySettings);

    if (dryRun) {
      await prisma.shopifyJob.update({
        where: { id: job.id },
        data: {
          status: "SUCCEEDED",
          lastError: null,
          result: {
            dryRun: true,
            message: "Simulated update",
            payload: {
              variantId: parsedPayload.variantId,
              newPrice: guardrail.suggestedPriceFinal,
            },
          } as Prisma.InputJsonValue,
        },
      });
      await logTelemetry(prisma, workspaceId, "SHOPIFY_JOB_PROCESSED", {
        jobId: job.id,
        status: "SUCCEEDED",
        dryRun: true,
      });
      processed.push({ jobId: job.id, status: "SUCCEEDED", message: "Dry run simulated" });
      continue;
    }

    try {
      const mutationResult = await shopifyFetch<{
        productVariantUpdate: {
          productVariant: { id: string; price: string } | null;
          userErrors: Array<{ field: string[] | null; message: string }>;
        };
      }>(
        {
          shopDomain: shopifySettings.shopDomain!,
          adminAccessToken: shopifySettings.adminAccessToken!,
        },
        UPDATE_MUTATION,
        {
          input: {
            id: normalizeVariantGid(parsedPayload.variantId),
            price: guardrail.suggestedPriceFinal.toFixed(2),
          },
        },
      );

      const userErrors = mutationResult?.productVariantUpdate?.userErrors ?? [];
      if (userErrors.length > 0) {
        throw new Error(userErrors.map((item) => item.message).join("; "));
      }

      await prisma.shopifyJob.update({
        where: { id: job.id },
        data: {
          status: "SUCCEEDED",
          lastError: null,
          result: {
            dryRun: false,
            response: mutationResult,
          } as Prisma.InputJsonValue,
        },
      });
      await logTelemetry(prisma, workspaceId, "SHOPIFY_JOB_PROCESSED", {
        jobId: job.id,
        status: "SUCCEEDED",
        dryRun: false,
      });
      processed.push({ jobId: job.id, status: "SUCCEEDED" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Shopify update failed";
      await prisma.shopifyJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError: message,
          result: {
            dryRun: false,
            error: message,
          } as Prisma.InputJsonValue,
        },
      });
      await logTelemetry(prisma, workspaceId, "SHOPIFY_JOB_PROCESSED", {
        jobId: job.id,
        status: "FAILED",
        dryRun: false,
      });
      processed.push({ jobId: job.id, status: "FAILED", message });
    }
  }

  return processed;
}

