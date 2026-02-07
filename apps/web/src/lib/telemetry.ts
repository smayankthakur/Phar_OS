import type { Prisma } from "@pharos/db";

export function telemetryEnabled() {
  return process.env.PHAROS_TELEMETRY !== "0";
}

export async function logTelemetry(
  db: { telemetryEvent: { create: (args: { data: Prisma.TelemetryEventCreateInput }) => Promise<unknown> } },
  workspaceId: string,
  type:
    | "DEMO_RESET"
    | "SIMULATION_RUN"
    | "ACTION_APPLIED"
    | "CSV_IMPORT_COMMIT"
    | "SETTINGS_UPDATED"
    | "WORKSPACE_CLONED"
    | "IMPORT_SKUS_COMMIT"
    | "IMPORT_COMPETITORS_COMMIT"
    | "IMPORT_SNAPSHOTS_COMMIT"
    | "PORTAL_VIEW"
    | "PORTAL_TOKEN_CREATED"
    | "PORTAL_TOKEN_REVOKED"
    | "SHOPIFY_JOB_QUEUED"
    | "SHOPIFY_JOB_PROCESSED"
    | "NOTIFICATION_QUEUED"
    | "NOTIFICATION_SENT"
    | "NOTIFICATION_FAILED"
    | "AUTH_LOGIN_SUCCESS"
    | "AUTH_LOGIN_FAILED"
    | "AUTH_LOGOUT"
    | "PLAN_CHANGED"
    | "LIMIT_BLOCKED"
    | "STRIPE_CHECKOUT_CREATED"
    | "STRIPE_WEBHOOK_PROCESSED"
    | "BILLING_STATUS_CHANGED"
    | "RESELLER_CREATED"
    | "CLIENT_WORKSPACE_CREATED"
    | "PLAN_OVERRIDE_SET"
    | "DOMAIN_MAPPED"
    | "BRANDING_UPDATED",
  meta?: Record<string, unknown>,
) {
  if (!telemetryEnabled()) return;

  await db.telemetryEvent.create({
    data: {
      workspace: {
        connect: { id: workspaceId },
      },
      type,
      meta: (meta ?? null) as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
    },
  });
}
