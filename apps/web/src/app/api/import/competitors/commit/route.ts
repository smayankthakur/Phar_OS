import { ZodError } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { EntitlementError, requireBillingWriteAccess, requireFeature, requireWithinLimit } from "@/lib/entitlements";
import { parseCompetitorsCsv } from "@/lib/importCenterCsv";
import { prisma } from "@/lib/prisma";
import { RateLimitError, rateLimitOrThrow } from "@/lib/ratelimit";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace } from "@/lib/tenant";
import { bulkImportBodySchema } from "@/lib/validation";

export async function POST(request: Request) {
  const { workspace } = await getCurrentWorkspace();
  try {
    await rateLimitOrThrow({
      route: "import.competitors.commit",
      scopeKey: `ws:${workspace.id}`,
      limit: 20,
      windowSec: 60,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return err("TOO_MANY_REQUESTS", error.message, 429);
  }

  try {
    await requireFeature(workspace.id, "csvImport");
    await requireBillingWriteAccess(workspace.id, "competitor_import_commit");
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

  const structurallyInvalidRows = new Set(parsed.errors.map((item) => item.idx));
  const existingBefore = await prisma.competitor.findMany({
    where: { workspaceId: workspace.id, name: { in: parsed.rows.map((row) => row.name) } },
    select: { name: true },
  });
  const existingSetBefore = new Set(existingBefore.map((item) => item.name));
  const uniqueNew = new Set(
    parsed.rows
      .filter((row) => !structurallyInvalidRows.has(row.idx))
      .map((row) => row.name)
      .filter((name) => !existingSetBefore.has(name)),
  );
  try {
    await requireWithinLimit(workspace.id, "competitors", uniqueNew.size);
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    return err("INTERNAL", "Failed to check competitor limits", 500);
  }

  const result = await prisma.$transaction(async (tx) => {
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const existing = await tx.competitor.findMany({
      where: { workspaceId: workspace.id, name: { in: parsed.rows.map((row) => row.name) } },
      select: { name: true },
    });
    const existingSet = new Set(existing.map((item) => item.name));

    for (const row of parsed.rows) {
      if (structurallyInvalidRows.has(row.idx)) {
        skippedCount += 1;
        continue;
      }

      const wasExisting = existingSet.has(row.name);
      await tx.competitor.upsert({
        where: {
          workspaceId_name: {
            workspaceId: workspace.id,
            name: row.name,
          },
        },
        create: {
          workspaceId: workspace.id,
          name: row.name,
          domain: row.domain,
          currency: row.currency,
        },
        update: {
          domain: row.domain,
          currency: row.currency,
        },
      });

      if (wasExisting) {
        updatedCount += 1;
      } else {
        createdCount += 1;
        existingSet.add(row.name);
      }
    }

    return {
      importedCount: createdCount + updatedCount,
      createdCount,
      updatedCount,
      skippedCount,
    };
  });

  await logTelemetry(prisma, workspace.id, "IMPORT_COMPETITORS_COMMIT", {
    importedCount: result.importedCount,
    updatedCount: result.updatedCount,
  });

  return ok(result);
}
