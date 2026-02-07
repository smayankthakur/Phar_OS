import { z } from "zod";
import { Prisma } from "@pharos/db";

const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const createCompetitorSchema = z.object({
  name: z.string().min(2),
  domain: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || domainPattern.test(value), "Invalid domain format"),
  currency: z.string().trim().length(3).optional(),
});

export const updateCompetitorSchema = z
  .object({
    name: z.string().min(2).optional(),
    domain: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || domainPattern.test(value), "Invalid domain format"),
    currency: z.string().trim().length(3).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const createSnapshotSchema = z.object({
  competitorId: z.string().min(1),
  price: z.number().positive(),
  capturedAt: z.string().datetime().optional(),
});

export const snapshotQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type CompetitorDTO = {
  id: string;
  workspaceId: string;
  name: string;
  domain: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type SnapshotDTO = {
  id: string;
  workspaceId: string;
  skuId: string;
  competitorId: string;
  price: number;
  capturedAt: string;
  source: string;
};

export function toCompetitorDTO(value: {
  id: string;
  workspaceId: string;
  name: string;
  domain: string | null;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}): CompetitorDTO {
  return {
    id: value.id,
    workspaceId: value.workspaceId,
    name: value.name,
    domain: value.domain,
    currency: value.currency,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

export function toSnapshotDTO(value: {
  id: string;
  workspaceId: string;
  skuId: string;
  competitorId: string;
  price: Prisma.Decimal;
  capturedAt: Date;
  source: string;
}): SnapshotDTO {
  return {
    id: value.id,
    workspaceId: value.workspaceId,
    skuId: value.skuId,
    competitorId: value.competitorId,
    price: value.price.toNumber(),
    capturedAt: value.capturedAt.toISOString(),
    source: value.source,
  };
}

export function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
