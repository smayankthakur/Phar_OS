import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/apiResponse";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { getCurrentWorkspace } from "@/lib/tenant";
import { createSnapshotSchema, snapshotQuerySchema, toSnapshotDTO } from "@/lib/competitors";

export async function GET(request: Request, { params }: { params: Promise<{ skuId: string }> }) {
  const { workspace } = await getCurrentWorkspace();
  const { skuId } = await params;
  const url = new URL(request.url);

  let query;
  try {
    query = snapshotQuerySchema.parse({
      limit: url.searchParams.get("limit") ?? undefined,
    });
  } catch {
    return err("BAD_REQUEST", "Invalid query params", 400);
  }

  const sku = await prisma.sKU.findFirst({
    where: {
      id: skuId,
      workspaceId: workspace.id,
    },
    select: { id: true },
  });

  if (!sku) {
    return err("NOT_FOUND", "SKU not found", 404);
  }

  const snapshots = await prisma.competitorSnapshot.findMany({
    where: {
      workspaceId: workspace.id,
      skuId,
    },
    orderBy: { capturedAt: "desc" },
    take: query.limit,
  });

  return ok({ items: snapshots.map(toSnapshotDTO) });
}

export async function POST(request: Request, { params }: { params: Promise<{ skuId: string }> }) {
  try {
    await verifyCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
  }

  const { workspace } = await getCurrentWorkspace();
  const { skuId } = await params;

  let payload;
  try {
    payload = createSnapshotSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return err("BAD_REQUEST", "Invalid snapshot payload", 400);
    }
    return err("BAD_REQUEST", "Invalid request body", 400);
  }

  const [sku, competitor] = await Promise.all([
    prisma.sKU.findFirst({
      where: {
        id: skuId,
        workspaceId: workspace.id,
      },
      select: { id: true, workspaceId: true },
    }),
    prisma.competitor.findFirst({
      where: {
        id: payload.competitorId,
        workspaceId: workspace.id,
      },
      select: { id: true, workspaceId: true },
    }),
  ]);

  if (!sku || !competitor) {
    return err("NOT_FOUND", "SKU or competitor not found", 404);
  }

  if (sku.workspaceId !== workspace.id || competitor.workspaceId !== workspace.id) {
    return err("NOT_FOUND", "SKU or competitor not found", 404);
  }

  const snapshot = await prisma.competitorSnapshot.create({
    data: {
      workspaceId: workspace.id,
      skuId: sku.id,
      competitorId: competitor.id,
      price: payload.price,
      capturedAt: payload.capturedAt ? new Date(payload.capturedAt) : new Date(),
      source: "MANUAL",
    },
  });

  return ok({ item: toSnapshotDTO(snapshot) }, 201);
}
