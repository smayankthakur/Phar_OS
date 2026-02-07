import { ZodError } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/rbac";
import { getCurrentWorkspace } from "@/lib/tenant";
import { ensureWorkspaceSettings, normalizePricingSettings } from "@/lib/settings";
import { logTelemetry } from "@/lib/telemetry";
import { patchPricingSettingsSchema } from "@/lib/validation";

export async function GET() {
  const { workspace } = await getCurrentWorkspace();
  const settings = await ensureWorkspaceSettings(workspace.id);

  return ok({
    item: {
      id: settings.id,
      workspaceId: settings.workspaceId,
      ...normalizePricingSettings(settings),
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    },
  });
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
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize settings update", 500);
  }
  let payload: Awaited<ReturnType<typeof patchPricingSettingsSchema.parse>>;

  try {
    payload = patchPricingSettingsSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return err("BAD_REQUEST", "Invalid pricing settings payload", 400);
    }
    return err("BAD_REQUEST", "Invalid request body", 400);
  }

  if (Object.keys(payload).length === 0) {
    return err("BAD_REQUEST", "At least one settings field is required", 400);
  }

  const existing = await ensureWorkspaceSettings(workspace.id);
  const updated = await prisma.workspaceSettings.update({
    where: { id: existing.id },
    data: {
      ...(payload.minMarginPercent !== undefined ? { minMarginPercent: payload.minMarginPercent } : {}),
      ...(payload.maxPriceChangePercent !== undefined ? { maxPriceChangePercent: payload.maxPriceChangePercent } : {}),
      ...(payload.roundingMode !== undefined ? { roundingMode: payload.roundingMode } : {}),
    },
  });
  await logTelemetry(prisma, workspace.id, "SETTINGS_UPDATED", {
    minMarginPercent: updated.minMarginPercent.toNumber(),
    maxPriceChangePercent: updated.maxPriceChangePercent.toNumber(),
    roundingMode: updated.roundingMode,
  });

  return ok({
    item: {
      id: updated.id,
      workspaceId: updated.workspaceId,
      ...normalizePricingSettings(updated),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}
