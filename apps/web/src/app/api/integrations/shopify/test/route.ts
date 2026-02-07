import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { EntitlementError, requireFeature } from "@/lib/entitlements";
import { requireOwner } from "@/lib/rbac";
import { getCurrentWorkspace } from "@/lib/tenant";
import { getShopifySettings, isShopifyConfigured, shopifyFetch } from "@/lib/shopifyClient";

const TEST_QUERY = `query ShopInfo { shop { name myshopifyDomain } }`;

export async function POST(request: Request) {
  try {
    await verifyCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
  }

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
    return err("INTERNAL", "Failed to authorize Shopify test", 500);
  }
  const settings = await getShopifySettings(workspace.id);

  if (settings.priceUpdateMode === "DRY_RUN") {
    return ok({ dryRun: true, configured: isShopifyConfigured(settings) });
  }

  if (!isShopifyConfigured(settings) || !settings.shopDomain || !settings.adminAccessToken) {
    return err("BAD_REQUEST", "Shopify is not configured for LIVE mode", 400);
  }

  try {
    const data = await shopifyFetch<{ shop: { name: string; myshopifyDomain: string } }>(
      {
        shopDomain: settings.shopDomain,
        adminAccessToken: settings.adminAccessToken,
      },
      TEST_QUERY,
    );

    return ok({
      dryRun: false,
      shop: data?.shop ?? null,
    });
  } catch (error) {
    return err("INTERNAL", error instanceof Error ? error.message : "Shopify test connection failed", 500);
  }
}
