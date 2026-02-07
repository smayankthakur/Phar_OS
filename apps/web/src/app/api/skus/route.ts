import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/apiResponse";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { EntitlementError, requireWithinLimit } from "@/lib/entitlements";
import { getCurrentWorkspace } from "@/lib/tenant";
import { createSkuSchema, isUniqueConstraintError, listSkusQuerySchema, toSkuDTO } from "@/lib/sku";

export async function GET(request: Request) {
  const { workspace } = await getCurrentWorkspace();
  const url = new URL(request.url);

  let parsedQuery;
  try {
    parsedQuery = listSkusQuerySchema.parse({
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
  } catch {
    return err("BAD_REQUEST", "Invalid query params", 400);
  }

  const skus = await prisma.sKU.findMany({
    where: {
      workspaceId: workspace.id,
      ...(parsedQuery.q
        ? {
            OR: [
              { title: { contains: parsedQuery.q, mode: "insensitive" } },
              { sku: { contains: parsedQuery.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(parsedQuery.status ? { status: parsedQuery.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: parsedQuery.limit,
  });

  return ok({ items: skus.map(toSkuDTO) });
}

export async function POST(request: Request) {
  try {
    await verifyCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
  }

  const { workspace } = await getCurrentWorkspace();
  let payload;
  try {
    payload = createSkuSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return err("BAD_REQUEST", "Invalid SKU payload", 400);
    }
    return err("BAD_REQUEST", "Invalid request body", 400);
  }

  try {
    await requireWithinLimit(workspace.id, "skus", 1);
    const created = await prisma.$transaction(async (tx) => {
      return tx.sKU.create({
        data: {
          workspaceId: workspace.id,
          title: payload.title,
          sku: payload.sku,
          cost: payload.cost,
          currentPrice: payload.currentPrice,
          status: payload.status,
          shopifyProductId: payload.shopifyProductId ?? null,
          shopifyVariantId: payload.shopifyVariantId ?? null,
        },
      });
    });

    return ok({ item: toSkuDTO(created) }, 201);
  } catch (error) {
    if (error instanceof EntitlementError) {
      return err("FORBIDDEN", error.message, 403);
    }
    if (isUniqueConstraintError(error)) {
      return err("CONFLICT", "SKU code already exists in this workspace", 409);
    }
    return err("INTERNAL", "Failed to create SKU", 500);
  }
}
