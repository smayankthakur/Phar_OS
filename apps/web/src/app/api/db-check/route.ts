import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/apiResponse";
import { requireSessionForApi } from "@/lib/auth";
import { isClientDemoMode } from "@/lib/demoMode";
import { getWorkspacePlan } from "@/lib/entitlements";
import { getCurrentWorkspace } from "@/lib/tenant";

export async function GET() {
  try {
    const session = await requireSessionForApi();
    const current = await getCurrentWorkspace();
    const clientDemoMode = await isClientDemoMode();
    const planInfo = await getWorkspacePlan(current.workspace.id);

    const [workspaces, skusCount] = await Promise.all([
      prisma.workspace.count(),
      prisma.sKU.count({ where: { workspaceId: current.workspace.id } }),
    ]);

    const [competitorsCount, snapshotsCount, eventsCount, rulesEnabledCount, rulesCount, actionsRecommendedCount, actionsAppliedCount, auditsCount, settingsCount, blockedActionsCount, lastTelemetryEvent, portalTokensActiveCount, shopifySettings, queuedJobsCount, failedJobsCount, notificationSettings, outboxQueuedCount, outboxFailedCount] = await Promise.all([
      prisma.competitor.count({ where: { workspaceId: current.workspace.id } }),
      prisma.competitorSnapshot.count({ where: { workspaceId: current.workspace.id } }),
      prisma.event.count({ where: { workspaceId: current.workspace.id } }),
      prisma.rule.count({ where: { workspaceId: current.workspace.id, enabled: true } }),
      prisma.rule.count({ where: { workspaceId: current.workspace.id } }),
      prisma.action.count({ where: { workspaceId: current.workspace.id, status: "RECOMMENDED" } }),
      prisma.action.count({ where: { workspaceId: current.workspace.id, status: "APPLIED" } }),
      prisma.auditLog.count({ where: { workspaceId: current.workspace.id } }),
      prisma.workspaceSettings.count({ where: { workspaceId: current.workspace.id } }),
      prisma.action.count({ where: { workspaceId: current.workspace.id, safetyStatus: "BLOCKED" } }),
      prisma.telemetryEvent.findFirst({
        where: { workspaceId: current.workspace.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, createdAt: true },
      }),
      prisma.portalToken.count({
        where: {
          workspaceId: current.workspace.id,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
      prisma.workspaceShopifySettings.findUnique({
        where: { workspaceId: current.workspace.id },
        select: { shopDomain: true, adminAccessToken: true },
      }),
      prisma.shopifyJob.count({
        where: { workspaceId: current.workspace.id, status: "QUEUED" },
      }),
      prisma.shopifyJob.count({
        where: { workspaceId: current.workspace.id, status: "FAILED" },
      }),
      prisma.workspaceNotificationSettings.findUnique({
        where: { workspaceId: current.workspace.id },
        select: { emailRecipients: true, webhookUrl: true },
      }),
      prisma.notificationOutbox.count({
        where: { workspaceId: current.workspace.id, status: "QUEUED" },
      }),
      prisma.notificationOutbox.count({
        where: { workspaceId: current.workspace.id, status: "FAILED" },
      }),
    ]);

    return ok({
      workspaces,
      skusCount,
      skuCount: skusCount,
      competitorsCount,
      snapshotsCount,
      rulesCount,
      eventsCount,
      rulesEnabledCount,
      actionsRecommendedCount,
      actionsAppliedCount,
      blockedActionsCount,
      portalTokensActiveCount,
      shopifyConfigured: Boolean(shopifySettings?.shopDomain && shopifySettings?.adminAccessToken),
      queuedJobsCount,
      failedJobsCount,
      notifyConfigured: Boolean(
        (notificationSettings?.emailRecipients && notificationSettings.emailRecipients.trim().length > 0) ||
          (notificationSettings?.webhookUrl && notificationSettings.webhookUrl.trim().length > 0),
      ),
      outboxQueuedCount,
      outboxFailedCount,
      csvImportLimit: 2000,
      auditsCount,
      auditLogCount: auditsCount,
      settingsPresent: settingsCount > 0,
      clientDemoMode,
      currentWorkspaceName: current.workspace.name,
      currentWorkspace: {
        id: current.workspace.id,
        name: current.workspace.name,
      },
      actor: {
        userId: session.userId,
        email: session.user.email,
        role: current.role,
      },
      plan: planInfo.plan,
      billingStatus: planInfo.status,
      usage: planInfo.usage,
      lastTelemetryEvent: lastTelemetryEvent
        ? {
            id: lastTelemetryEvent.id,
            type: lastTelemetryEvent.type,
            createdAt: lastTelemetryEvent.createdAt.toISOString(),
          }
        : null,
    });
  } catch {
    return err("INTERNAL", "Failed to load db-check", 500);
  }
}
