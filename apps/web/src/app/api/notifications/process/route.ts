import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { EntitlementError, requireBillingWriteAccess, requireFeature } from "@/lib/entitlements";
import { processNotificationOutbox } from "@/lib/notify";
import { RateLimitError, rateLimitOrThrow } from "@/lib/ratelimit";
import { requireOwner } from "@/lib/rbac";
import { getCurrentWorkspace } from "@/lib/tenant";

const bodySchema = z.object({
  limit: z.number().int().min(1).max(50).default(10).optional(),
});

export async function POST(request: Request) {
  const { workspace } = await getCurrentWorkspace();
  try {
    await requireOwner(workspace.id);
    await requireFeature(workspace.id, "notifications");
    await requireBillingWriteAccess(workspace.id, "notifications_process");
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize notification processing", 500);
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json().catch(() => ({})));
  } catch {
    return err("BAD_REQUEST", "Invalid process payload", 400);
  }

  try {
    await rateLimitOrThrow({
      route: "notifications.process",
      scopeKey: `ws:${workspace.id}`,
      limit: 30,
      windowSec: 60,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return err("TOO_MANY_REQUESTS", error.message, 429);
  }

  const processed = await processNotificationOutbox(workspace.id, payload.limit ?? 10);
  return ok({ processed });
}
