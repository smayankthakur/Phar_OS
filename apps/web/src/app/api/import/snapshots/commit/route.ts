import { ZodError } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { EntitlementError, requireBillingWriteAccess, requireFeature, requireWithinLimit } from "@/lib/entitlements";
import { parseSnapshotsCsv } from "@/lib/importCenterCsv";
import { prisma } from "@/lib/prisma";
import { RateLimitError, rateLimitOrThrow } from "@/lib/ratelimit";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace } from "@/lib/tenant";
import { incrementSnapshotRows } from "@/lib/usage";
import { bulkImportBodySchema } from "@/lib/validation";

export async function POST(request: Request) {
  const { workspace } = await getCurrentWorkspace();
  try {
    await rateLimitOrThrow({
      route: "import.snapshots.commit",
      scopeKey: `ws:${workspace.id}`,
      limit: 20,
      windowSec: 60,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return err("TOO_MANY_REQUESTS", error.message, 429);
  }

  try {
    await requireFeature(workspace.id, "csvImport");
    await requireBillingWriteAccess(workspace.id, "snapshot_bulk_import_commit");
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

  const createMissingCompetitors = payload.options?.createMissingCompetitors === true;
  const parsed = parseSnapshotsCsv(payload.csvText);
  if ("fatalError" in parsed) {
    return err("BAD_REQUEST", parsed.fatalError, 400);
  }
  try {
    await requireWithinLimit(workspace.id, "snapshotRows", parsed.totalRows);
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    return err("INTERNAL", "Failed to check snapshot import limits", 500);
  }

  const structurallyInvalidRows = new Set(parsed.errors.map((item) => item.idx));

  const result = await prisma.$transaction(async (tx) => {
    const skus = await tx.sKU.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, sku: true },
    });
    const skuMap = new Map(skus.map((item) => [item.sku, item.id]));

    const competitors = await tx.competitor.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true },
    });
    const competitorMap = new Map(competitors.map((item) => [item.name.toLowerCase(), { id: item.id, name: item.name }]));

    let createdCompetitorsCount = 0;

    if (createMissingCompetitors) {
      const missingByKey = new Map<string, string>();
      for (const row of parsed.rows) {
        if (structurallyInvalidRows.has(row.idx)) continue;
        const key = row.competitorName.toLowerCase();
        if (!competitorMap.has(key) && !missingByKey.has(key)) {
          missingByKey.set(key, row.competitorName);
        }
      }

      for (const [key, name] of missingByKey) {
        const created = await tx.competitor.create({
          data: {
            workspaceId: workspace.id,
            name,
            currency: "INR",
          },
          select: { id: true, name: true },
        });
        competitorMap.set(key, created);
        createdCompetitorsCount += 1;
      }
    }

    let skippedCount = 0;
    const toInsert: Array<{
      workspaceId: string;
      skuId: string;
      competitorId: string;
      price: number;
      capturedAt: Date;
      source: string;
    }> = [];

    for (const row of parsed.rows) {
      if (structurallyInvalidRows.has(row.idx)) {
        skippedCount += 1;
        continue;
      }

      const skuId = skuMap.get(row.sku);
      if (!skuId) {
        skippedCount += 1;
        continue;
      }

      const competitor = competitorMap.get(row.competitorName.toLowerCase());
      if (!competitor) {
        skippedCount += 1;
        continue;
      }

      toInsert.push({
        workspaceId: workspace.id,
        skuId,
        competitorId: competitor.id,
        price: row.price,
        capturedAt: row.capturedAt,
        source: "CSV",
      });
    }

    if (toInsert.length > 0) {
      await tx.competitorSnapshot.createMany({ data: toInsert });
    }

    return {
      importedCount: toInsert.length,
      skippedCount,
      createdCompetitorsCount,
    };
  });

  await logTelemetry(prisma, workspace.id, "IMPORT_SNAPSHOTS_COMMIT", {
    importedCount: result.importedCount,
    createdCompetitorsCount: result.createdCompetitorsCount,
  });
  if (result.importedCount > 0) {
    await incrementSnapshotRows(workspace.id, result.importedCount);
  }

  return ok(result);
}
