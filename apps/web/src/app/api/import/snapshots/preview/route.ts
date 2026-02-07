import { ZodError } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { EntitlementError, requireFeature } from "@/lib/entitlements";
import { BULK_IMPORT_LIMIT, parseSnapshotsCsv } from "@/lib/importCenterCsv";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/tenant";
import { bulkImportBodySchema } from "@/lib/validation";

export async function POST(request: Request) {
  const { workspace } = await getCurrentWorkspace();
  try {
    await requireFeature(workspace.id, "csvImport");
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

  const [skus, competitors] = await Promise.all([
    prisma.sKU.findMany({
      where: { workspaceId: workspace.id, sku: { in: parsed.rows.map((row) => row.sku) } },
      select: { sku: true },
    }),
    prisma.competitor.findMany({
      where: { workspaceId: workspace.id },
      select: { name: true },
    }),
  ]);

  const skuSet = new Set(skus.map((item) => item.sku));
  const competitorSet = new Set(competitors.map((item) => item.name.toLowerCase()));

  const errors = [...parsed.errors];
  const missingCompetitors = new Set<string>();

  for (const row of parsed.rows) {
    if (!skuSet.has(row.sku)) {
      errors.push({ idx: row.idx, field: "sku", message: `SKU "${row.sku}" not found` });
    }

    const competitorExists = competitorSet.has(row.competitorName.toLowerCase());
    if (!competitorExists) {
      missingCompetitors.add(row.competitorName.toLowerCase());
      if (!createMissingCompetitors) {
        errors.push({ idx: row.idx, field: "competitor_name", message: `Competitor "${row.competitorName}" not found` });
      }
    }
  }

  const invalidIdx = new Set(errors.map((item) => item.idx));
  const validRows = parsed.totalRows - invalidIdx.size;

  return ok({
    preview: {
      rows: parsed.rows.slice(0, 50).map((row) => ({
        idx: row.idx,
        sku: row.sku,
        competitorName: row.competitorName,
        price: row.price,
        capturedAtISO: row.capturedAt.toISOString(),
        skuExists: skuSet.has(row.sku),
        competitorExists: competitorSet.has(row.competitorName.toLowerCase()),
        valid: !invalidIdx.has(row.idx),
      })),
      errors,
      summary: {
        totalRows: parsed.totalRows,
        validRows: Math.max(validRows, 0),
        invalidRows: invalidIdx.size,
        missingCompetitorsCount: missingCompetitors.size,
        importLimit: BULK_IMPORT_LIMIT,
      },
    },
  });
}
