import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { EntitlementError, requireBillingWriteAccess, requireFeature, requireWithinLimit } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { parseSnapshotCsv } from "@/lib/snapshotCsv";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace } from "@/lib/tenant";
import { incrementSnapshotRows } from "@/lib/usage";

const bodySchema = z.object({
  csvText: z.string().min(1),
  createMissingCompetitors: z.boolean().default(false),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ skuId: string }> },
) {
  const { workspace } = await getCurrentWorkspace();
  try {
    await requireFeature(workspace.id, "csvImport");
    await requireBillingWriteAccess(workspace.id, "snapshot_import_commit");
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    return err("INTERNAL", "Failed to resolve csv import entitlement", 500);
  }
  const { skuId } = await params;

  const sku = await prisma.sKU.findFirst({
    where: { id: skuId, workspaceId: workspace.id },
    select: { id: true },
  });

  if (!sku) {
    return err("NOT_FOUND", "SKU not found", 404);
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid import payload", 400);
  }

  const parsed = parseSnapshotCsv(payload.csvText);
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

  try {
    const result = await prisma.$transaction(async (tx) => {
      let createdCompetitorsCount = 0;

      const existing = await tx.competitor.findMany({
        where: { workspaceId: workspace.id },
        select: { id: true, name: true },
      });
      const byLower = new Map(existing.map((item) => [item.name.toLowerCase(), item]));

      if (payload.createMissingCompetitors) {
        const missingNames = new Map<string, string>();
        for (const row of parsed.rows) {
          if (structurallyInvalidRows.has(row.idx)) continue;
          const key = row.competitorName.toLowerCase();
          if (!byLower.has(key) && !missingNames.has(key)) {
            missingNames.set(key, row.competitorName);
          }
        }

        for (const [, name] of missingNames) {
          const created = await tx.competitor.create({
            data: {
              workspaceId: workspace.id,
              name,
              currency: "INR",
            },
            select: { id: true, name: true },
          });
          byLower.set(created.name.toLowerCase(), created);
          createdCompetitorsCount += 1;
        }
      }

      const rowsToInsert: Array<{
        workspaceId: string;
        skuId: string;
        competitorId: string;
        price: number;
        capturedAt: Date;
        source: string;
      }> = [];

      let skippedCount = 0;
      for (const row of parsed.rows) {
        if (structurallyInvalidRows.has(row.idx)) {
          skippedCount += 1;
          continue;
        }

        const competitor = byLower.get(row.competitorName.toLowerCase());
        if (!competitor) {
          skippedCount += 1;
          continue;
        }

        rowsToInsert.push({
          workspaceId: workspace.id,
          skuId: sku.id,
          competitorId: competitor.id,
          price: row.price,
          capturedAt: row.capturedAt,
          source: "CSV",
        });
      }

      if (rowsToInsert.length > 0) {
        await tx.competitorSnapshot.createMany({ data: rowsToInsert });
      }

      return {
        importedCount: rowsToInsert.length,
        skippedCount,
        createdCompetitorsCount,
      };
    });
    if (result.importedCount > 0) {
      await incrementSnapshotRows(workspace.id, result.importedCount);
    }
    await logTelemetry(prisma, workspace.id, "CSV_IMPORT_COMMIT", {
      skuId: sku.id,
      importedCount: result.importedCount,
      skippedCount: result.skippedCount,
      createdCompetitorsCount: result.createdCompetitorsCount,
    });

    return ok(result);
  } catch (error) {
    return err("INTERNAL", error instanceof Error ? error.message : "Import commit failed", 500);
  }
}
