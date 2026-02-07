import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { EntitlementError, requireBillingWriteAccess, requireFeature } from "@/lib/entitlements";
import { requireOwner } from "@/lib/rbac";
import { getCurrentWorkspace } from "@/lib/tenant";
import { processShopifyJobs } from "@/lib/shopifyJobs";
import { RateLimitError, rateLimitOrThrow } from "@/lib/ratelimit";

const processSchema = z.object({
  limit: z.number().int().min(1).max(50).default(5).optional(),
});

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
    await requireBillingWriteAccess(workspace.id, "shopify_job_process");
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize Shopify processing", 500);
  }

  let payload: z.infer<typeof processSchema>;
  try {
    payload = processSchema.parse(await request.json().catch(() => ({})));
  } catch {
    return err("BAD_REQUEST", "Invalid process payload", 400);
  }

  const limit = payload.limit ?? 5;
  try {
    await rateLimitOrThrow({
      route: "shopify.jobs.process",
      scopeKey: `ws:${workspace.id}`,
      limit: 30,
      windowSec: 60,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return err("TOO_MANY_REQUESTS", error.message, 429);
  }

  const processed = await processShopifyJobs(workspace.id, limit);
  return ok({ processed });
}
