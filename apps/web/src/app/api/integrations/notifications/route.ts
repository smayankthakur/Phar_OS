import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { EntitlementError, requireFeature } from "@/lib/entitlements";
import { getCurrentWorkspace } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/rbac";
import {
  ensureWorkspaceNotificationSettings,
  parseNotificationMode,
  toNotificationSettingsDTO,
} from "@/lib/notify";

const patchSchema = z
  .object({
    emailRecipients: z.string().trim().max(2000).nullable().optional(),
    webhookUrl: z.string().trim().url().nullable().optional(),
    notifyMode: z.enum(["DRY_RUN", "LIVE"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export async function GET() {
  const { workspace } = await getCurrentWorkspace();
  try {
    await requireFeature(workspace.id, "notifications");
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    return err("INTERNAL", "Failed to resolve notifications entitlement", 500);
  }
  const settings = await ensureWorkspaceNotificationSettings(workspace.id);
  return ok({ item: toNotificationSettingsDTO(settings) });
}

export async function PATCH(request: Request) {
  try {
    await verifyCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
  }

  const { workspace } = await getCurrentWorkspace();
  try {
    await requireOwner(workspace.id);
    await requireFeature(workspace.id, "notifications");
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize notification settings update", 500);
  }

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid notification settings payload", 400);
  }

  const current = await ensureWorkspaceNotificationSettings(workspace.id);
  const updated = await prisma.workspaceNotificationSettings.update({
    where: { id: current.id },
    data: {
      ...(payload.emailRecipients !== undefined ? { emailRecipients: payload.emailRecipients?.trim() || null } : {}),
      ...(payload.webhookUrl !== undefined ? { webhookUrl: payload.webhookUrl?.trim() || null } : {}),
      ...(payload.notifyMode !== undefined ? { notifyMode: parseNotificationMode(payload.notifyMode) } : {}),
    },
  });

  return ok({ item: toNotificationSettingsDTO(updated) });
}
