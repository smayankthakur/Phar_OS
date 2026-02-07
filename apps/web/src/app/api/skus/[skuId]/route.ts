import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/apiResponse";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { getCurrentWorkspace } from "@/lib/tenant";
import { isUniqueConstraintError, patchSkuSchema, toSkuDTO } from "@/lib/sku";

export async function GET(_: Request, { params }: { params: Promise<{ skuId: string }> }) {
  const { workspace } = await getCurrentWorkspace();
  const { skuId } = await params;

  const sku = await prisma.sKU.findFirst({
    where: {
      id: skuId,
      workspaceId: workspace.id,
    },
  });

  if (!sku) {
    return err("NOT_FOUND", "SKU not found", 404);
  }

  return ok({ item: toSkuDTO(sku) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ skuId: string }> }) {
  try {
    await verifyCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
  }

  const { workspace } = await getCurrentWorkspace();
  const { skuId } = await params;

  let payload;
  try {
    payload = patchSkuSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return err("BAD_REQUEST", "Invalid SKU update payload", 400);
    }
    return err("BAD_REQUEST", "Invalid request body", 400);
  }

  const existing = await prisma.sKU.findFirst({
    where: {
      id: skuId,
      workspaceId: workspace.id,
    },
  });

  if (!existing) {
    return err("NOT_FOUND", "SKU not found", 404);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      return tx.sKU.update({
        where: { id: existing.id },
        data: {
          ...(payload.title !== undefined ? { title: payload.title } : {}),
          ...(payload.sku !== undefined ? { sku: payload.sku } : {}),
          ...(payload.cost !== undefined ? { cost: payload.cost } : {}),
          ...(payload.currentPrice !== undefined ? { currentPrice: payload.currentPrice } : {}),
          ...(payload.status !== undefined ? { status: payload.status } : {}),
          ...(payload.shopifyProductId !== undefined ? { shopifyProductId: payload.shopifyProductId } : {}),
          ...(payload.shopifyVariantId !== undefined ? { shopifyVariantId: payload.shopifyVariantId } : {}),
        },
      });
    });

    return ok({ item: toSkuDTO(updated) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return err("CONFLICT", "SKU code already exists in this workspace", 409);
    }
    return err("INTERNAL", "Failed to update SKU", 500);
  }
}
