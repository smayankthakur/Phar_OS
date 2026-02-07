import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { EntitlementError, requireFeature } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { CSV_IMPORT_LIMIT, parseSnapshotCsv } from "@/lib/snapshotCsv";
import { getCurrentWorkspace } from "@/lib/tenant";

const bodySchema = z.object({
  csvText: z.string().min(1),
  createMissingCompetitors: z.boolean().default(false),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ skuId: string }> },
) {
  try {
    await verifyCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
  }

  const { workspace } = await getCurrentWorkspace();
  try {
    await requireFeature(workspace.id, "csvImport");
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

  const competitors = await prisma.competitor.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true, name: true },
  });
  const byNameLower = new Map(competitors.map((competitor) => [competitor.name.toLowerCase(), competitor]));

  const errors = [...parsed.errors];
  const missing = new Set<string>();
  for (const row of parsed.rows) {
    const exists = byNameLower.has(row.competitorName.toLowerCase());
    if (!exists) {
      missing.add(row.competitorName.toLowerCase());
      if (!payload.createMissingCompetitors) {
        errors.push({
          idx: row.idx,
          field: "competitor_name",
          message: `Competitor "${row.competitorName}" not found`,
        });
      }
    }
  }

  const invalidIdx = new Set(errors.map((item) => item.idx));
  const validRows = parsed.totalRows - invalidIdx.size;

  return ok({
    preview: {
      rows: parsed.rows.slice(0, 50).map((row) => ({
        idx: row.idx,
        competitorName: row.competitorName,
        price: row.price,
        capturedAtISO: row.capturedAt.toISOString(),
        competitorExists: byNameLower.has(row.competitorName.toLowerCase()),
        valid: !invalidIdx.has(row.idx),
      })),
      errors: errors.sort((a, b) => a.idx - b.idx),
      summary: {
        totalRows: parsed.totalRows,
        validRows: Math.max(validRows, 0),
        invalidRows: Math.max(invalidIdx.size, 0),
        missingCompetitorsCount: missing.size,
        csvImportLimit: CSV_IMPORT_LIMIT,
      },
    },
  });
}
