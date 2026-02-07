import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { EntitlementError, requireBillingWriteAccess, requireFeature } from "@/lib/entitlements";
import {
  buildNotifyMessage,
  enqueueNotifications,
  getNotificationSettings,
  notifyEnabled,
  processNotificationOutbox,
} from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/rbac";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace } from "@/lib/tenant";

export async function POST() {
  const { workspace } = await getCurrentWorkspace();
  try {
    await requireOwner(workspace.id);
    await requireFeature(workspace.id, "notifications");
    await requireBillingWriteAccess(workspace.id, "notifications_test");
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize notification test", 500);
  }

  const message = buildNotifyMessage({
    workspace,
    action: {
      id: "test-action",
      type: "NOTIFY",
      title: "Test notification",
      details: {},
    },
    sku: null,
  });

  const settings = await getNotificationSettings(workspace.id);
  if (settings.notifyMode === "DRY_RUN" || !notifyEnabled()) {
    return ok({ dryRun: true, queued: 0, processed: 0 });
  }

  const created = await prisma.$transaction(async (tx) => {
    return enqueueNotifications(tx, workspace.id, null, message);
  });
  for (const entry of created) {
    await logTelemetry(prisma, workspace.id, "NOTIFICATION_QUEUED", {
      outboxId: entry.id,
      type: entry.type,
    });
  }

  const processed = await processNotificationOutbox(workspace.id, 2);

  return ok({
    dryRun: false,
    queued: created.length,
    processed: processed.length,
  });
}
