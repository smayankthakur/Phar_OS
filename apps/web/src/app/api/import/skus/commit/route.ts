import { ZodError } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { EntitlementError, requireBillingWriteAccess, requireFeature, requireWithinLimit } from "@/lib/entitlements";
import { parseSkusCsv } from "@/lib/importCenterCsv";
import { prisma } from "@/lib/prisma";
import { RateLimitError, rateLimitOrThrow } from "@/lib/ratelimit";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace } from "@/lib/tenant";
import { bulkImportBodySchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    await verifyCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
  }

  const { workspace } = await getCurrentWorkspace();
  try {
    await rateLimitOrThrow({
      route: "import.skus.commit",
      scopeKey: `ws:${workspace.id}`,
      limit: 20,
      windowSec: 60,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return err("TOO_MANY_REQUESTS", error.message, 429);
  }

  try {
    await requireFeature(workspace.id, "csvImport");
    await requireBillingWriteAccess(workspace.id, "sku_import_commit");
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    return err("INTERNAL", "Failed to resolve csv import entitlement", 500);
  }

  let payload;
  try {
    payload = bulkImportBodySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return err("BAD_REQUEST", "Invalid import payload", 400);
    }
    return err("BAD_REQUEST", "Invalid request body", 400);
  }

  const parsed = parseSkusCsv(payload.csvText);
  if ("fatalError" in parsed) {
    return err("BAD_REQUEST", parsed.fatalError, 400);
  }

  const structurallyInvalidRows = new Set(parsed.errors.map((item) => item.idx));
  const existingBefore = await prisma.sKU.findMany({
    where: { workspaceId: workspace.id, sku: { in: parsed.rows.map((row) => row.sku) } },
    select: { sku: true },
  });
  const existingSetBefore = new Set(existingBefore.map((item) => item.sku));
  const uniqueNew = new Set(
    parsed.rows
      .filter((row) => !structurallyInvalidRows.has(row.idx))
      .map((row) => row.sku)
      .filter((sku) => !existingSetBefore.has(sku)),
  );
  try {
    await requireWithinLimit(workspace.id, "skus", uniqueNew.size);
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    return err("INTERNAL", "Failed to check SKU limits", 500);
  }

  const result = await prisma.$transaction(async (tx) => {
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const existing = await tx.sKU.findMany({
      where: { workspaceId: workspace.id, sku: { in: parsed.rows.map((row) => row.sku) } },
      select: { sku: true },
    });
    const existingSet = new Set(existing.map((item) => item.sku));

    for (const row of parsed.rows) {
      if (structurallyInvalidRows.has(row.idx)) {
        skippedCount += 1;
        continue;
      }

      const wasExisting = existingSet.has(row.sku);
      await tx.sKU.upsert({
        where: {
          workspaceId_sku: {
            workspaceId: workspace.id,
            sku: row.sku,
          },
        },
        create: {
          workspaceId: workspace.id,
          sku: row.sku,
          title: row.title,
          cost: row.cost,
          currentPrice: row.currentPrice,
          status: row.status,
        },
        update: {
          title: row.title,
          cost: row.cost,
          currentPrice: row.currentPrice,
          status: row.status,
        },
      });

      if (wasExisting) {
        updatedCount += 1;
      } else {
        createdCount += 1;
        existingSet.add(row.sku);
      }
    }

    return {
      importedCount: createdCount + updatedCount,
      createdCount,
      updatedCount,
      skippedCount,
    };
  });

  await logTelemetry(prisma, workspace.id, "IMPORT_SKUS_COMMIT", {
    importedCount: result.importedCount,
    updatedCount: result.updatedCount,
  });

  return ok(result);
}
