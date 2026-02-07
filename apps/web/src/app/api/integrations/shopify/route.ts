import { ZodError } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { EntitlementError, requireFeature } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/rbac";
import {
  ensureWorkspaceShopifySettings,
  normalizeShopDomain,
  parsePriceUpdateMode,
  toShopifySettingsDTO,
} from "@/lib/shopifyClient";
import { getCurrentWorkspace } from "@/lib/tenant";
import { patchShopifySettingsSchema } from "@/lib/validation";

export async function GET() {
  const { workspace } = await getCurrentWorkspace();
  try {
    await requireFeature(workspace.id, "shopify");
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    return err("INTERNAL", "Failed to resolve Shopify entitlement", 500);
  }
  const settings = await ensureWorkspaceShopifySettings(workspace.id);
  return ok({ item: toShopifySettingsDTO(settings) });
}

export async function PATCH(request: Request) {
  const { workspace } = await getCurrentWorkspace();
  try {
    await requireOwner(workspace.id);
    await requireFeature(workspace.id, "shopify");
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize Shopify settings update", 500);
  }

  let payload;
  try {
    payload = patchShopifySettingsSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return err("BAD_REQUEST", "Invalid Shopify settings payload", 400);
    }
    return err("BAD_REQUEST", "Invalid request body", 400);
  }

  const existing = await ensureWorkspaceShopifySettings(workspace.id);
  const updated = await prisma.workspaceShopifySettings.update({
    where: { id: existing.id },
    data: {
      ...(payload.shopDomain !== undefined ? { shopDomain: normalizeShopDomain(payload.shopDomain) } : {}),
      ...(payload.adminAccessToken !== undefined ? { adminAccessToken: payload.adminAccessToken?.trim() || null } : {}),
      ...(payload.priceUpdateMode !== undefined ? { priceUpdateMode: parsePriceUpdateMode(payload.priceUpdateMode) } : {}),
    },
  });

  return ok({ item: toShopifySettingsDTO(updated) });
}
