import { ZodError } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { EntitlementError, requireFeature } from "@/lib/entitlements";
import { BULK_IMPORT_LIMIT, parseSkusCsv } from "@/lib/importCenterCsv";
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

  const parsed = parseSkusCsv(payload.csvText);
  if ("fatalError" in parsed) {
    return err("BAD_REQUEST", parsed.fatalError, 400);
  }

  const sourceSkus = parsed.rows.map((row) => row.sku);
  const existingSkus = await prisma.sKU.findMany({
    where: { workspaceId: workspace.id, sku: { in: sourceSkus } },
    select: { sku: true },
  });
  const existingSet = new Set(existingSkus.map((item) => item.sku));

  const invalidIdx = new Set(parsed.errors.map((item) => item.idx));
  const validRows = parsed.totalRows - invalidIdx.size;

  return ok({
    preview: {
      rows: parsed.rows.slice(0, 50).map((row) => ({
        idx: row.idx,
        sku: row.sku,
        title: row.title,
        cost: row.cost,
        currentPrice: row.currentPrice,
        status: row.status,
        exists: existingSet.has(row.sku),
        valid: !invalidIdx.has(row.idx),
      })),
      errors: parsed.errors,
      summary: {
        totalRows: parsed.totalRows,
        validRows: Math.max(validRows, 0),
        invalidRows: invalidIdx.size,
        importLimit: BULK_IMPORT_LIMIT,
      },
    },
  });
}
