import { ZodError } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { EntitlementError, requireFeature } from "@/lib/entitlements";
import { BULK_IMPORT_LIMIT, parseCompetitorsCsv } from "@/lib/importCenterCsv";
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

  const parsed = parseCompetitorsCsv(payload.csvText);
  if ("fatalError" in parsed) {
    return err("BAD_REQUEST", parsed.fatalError, 400);
  }

  const names = parsed.rows.map((row) => row.name);
  const existing = await prisma.competitor.findMany({
    where: { workspaceId: workspace.id, name: { in: names } },
    select: { name: true },
  });
  const existingSet = new Set(existing.map((item) => item.name));

  const invalidIdx = new Set(parsed.errors.map((item) => item.idx));
  const validRows = parsed.totalRows - invalidIdx.size;

  return ok({
    preview: {
      rows: parsed.rows.slice(0, 50).map((row) => ({
        idx: row.idx,
        name: row.name,
        domain: row.domain,
        currency: row.currency,
        exists: existingSet.has(row.name),
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
