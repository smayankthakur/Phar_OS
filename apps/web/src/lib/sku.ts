import { z } from "zod";
import { Prisma } from "@pharos/db";

export const skuStatusSchema = z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]);

export const listSkusQuerySchema = z.object({
  q: z.string().optional(),
  status: skuStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const createSkuSchema = z.object({
  title: z.string().min(2),
  sku: z.string().min(2),
  cost: z.number().positive(),
  currentPrice: z.number().positive(),
  status: skuStatusSchema,
  shopifyProductId: z.string().min(1).optional(),
  shopifyVariantId: z.string().min(1).optional(),
});

export const patchSkuSchema = z
  .object({
    title: z.string().min(2).optional(),
    sku: z.string().min(2).optional(),
    cost: z.number().positive().optional(),
    currentPrice: z.number().positive().optional(),
    status: skuStatusSchema.optional(),
    shopifyProductId: z.string().min(1).nullable().optional(),
    shopifyVariantId: z.string().min(1).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export type SkuDTO = {
  id: string;
  workspaceId: string;
  title: string;
  sku: string;
  cost: number;
  currentPrice: number;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toSkuDTO(sku: {
  id: string;
  workspaceId: string;
  title: string;
  sku: string;
  cost: Prisma.Decimal;
  currentPrice: Prisma.Decimal;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SkuDTO {
  return {
    id: sku.id,
    workspaceId: sku.workspaceId,
    title: sku.title,
    sku: sku.sku,
    cost: sku.cost.toNumber(),
    currentPrice: sku.currentPrice.toNumber(),
    status: sku.status,
    shopifyProductId: sku.shopifyProductId,
    shopifyVariantId: sku.shopifyVariantId,
    createdAt: sku.createdAt.toISOString(),
    updatedAt: sku.updatedAt.toISOString(),
  };
}

export function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
