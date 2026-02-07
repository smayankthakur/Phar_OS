import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(120),
});

export const selectWorkspaceSchema = z.object({
  workspaceId: z.string().min(1),
});

export const workspaceCloneSchema = z.object({
  sourceWorkspaceId: z.string().min(1),
  newWorkspaceName: z.string().min(3).max(120),
  includeData: z.object({
    skus: z.boolean().default(false),
    competitors: z.boolean().default(false),
    snapshots: z.boolean().default(false),
  }),
  setAsCurrent: z.boolean().default(true),
  exitClientDemoMode: z.boolean().default(true),
});

export const bulkImportBodySchema = z.object({
  csvText: z.string().min(1),
  options: z.record(z.any()).optional(),
});

export const roundingModeSchema = z.enum(["NONE", "NEAREST_1", "NEAREST_5", "NEAREST_10"]);

export const patchPricingSettingsSchema = z.object({
  minMarginPercent: z.number().min(0).max(90).optional(),
  maxPriceChangePercent: z.number().min(0).max(100).optional(),
  roundingMode: roundingModeSchema.optional(),
});

export const priceUpdateModeSchema = z.enum(["DRY_RUN", "LIVE"]);

export const patchShopifySettingsSchema = z
  .object({
    shopDomain: z.string().trim().min(3).max(255).nullable().optional(),
    adminAccessToken: z.string().trim().min(8).max(255).nullable().optional(),
    priceUpdateMode: priceUpdateModeSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export async function parseJsonBody<T>(request: Request, schema: z.ZodSchema<T>): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}
