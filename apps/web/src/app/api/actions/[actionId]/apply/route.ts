import { enforceGuardrails } from "@pharos/core";
import { Prisma } from "@pharos/db";
import { buildNotifyMessage, enqueueNotifications } from "@/lib/notify";
import { AuthError } from "@/lib/auth";
import { EntitlementError, requireBillingWriteAccess, requireFeature } from "@/lib/entitlements";
import { getCurrentWorkspace } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { DEFAULT_PRICING_SETTINGS, parseRoundingMode } from "@/lib/settings";
import { logTelemetry } from "@/lib/telemetry";
import { err, ok } from "@/lib/apiResponse";
import { CsrfError, verifyCsrf } from "@/lib/csrf";

class ApplyActionError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function toSkuSnapshot(sku: {
  id: string;
  sku: string;
  title: string;
  cost: Prisma.Decimal;
  currentPrice: Prisma.Decimal;
  status: string;
  updatedAt: Date;
}) {
  return {
    id: sku.id,
    sku: sku.sku,
    title: sku.title,
    cost: sku.cost.toNumber(),
    currentPrice: sku.currentPrice.toNumber(),
    status: sku.status,
    updatedAt: sku.updatedAt.toISOString(),
  };
}

function requiresPriceUpdate(type: string) {
  return type === "PRICE_MATCH" || type === "PRICE_INCREASE";
}

function parseSuggestedPrice(details: Prisma.JsonValue) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const object = details as Record<string, unknown>;
  const rawOriginal = object.suggestedPriceOriginal;
  const rawLegacy = object.suggestedPrice;
  const candidate = typeof rawOriginal === "number" ? rawOriginal : rawLegacy;
  if (typeof candidate !== "number" || Number.isNaN(candidate) || candidate <= 0) return null;
  return candidate;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ actionId: string }> },
) {
  try {
    await verifyCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
  }

  const { workspace } = await getCurrentWorkspace();
  const actor = await requireRole(workspace.id, "ANALYST");
  const { actionId } = await params;

  const action = await prisma.action.findFirst({
    where: {
      id: actionId,
      workspaceId: workspace.id,
    },
  });

  if (!action) {
    return err("NOT_FOUND", "Action not found", 404);
  }

  if (action.status === "APPLIED") {
    return err("CONFLICT", "Already applied", 409);
  }

  const shouldUpdatePrice = requiresPriceUpdate(action.type);
  const suggestedPriceOriginal = shouldUpdatePrice ? parseSuggestedPrice(action.details) : null;

  if (shouldUpdatePrice && suggestedPriceOriginal === null) {
    return err("BAD_REQUEST", "Invalid suggestedPrice", 400);
  }

  if (shouldUpdatePrice && !action.skuId) {
    return err("BAD_REQUEST", "Action missing skuId", 400);
  }
  try {
    if (action.type === "NOTIFY") {
      await requireFeature(workspace.id, "notifications");
      await requireBillingWriteAccess(workspace.id, "notify_dispatch");
    }
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    return err("INTERNAL", "Failed to resolve notification entitlement", 500);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.action.updateMany({
        where: {
          id: action.id,
          workspaceId: workspace.id,
          status: "RECOMMENDED",
        },
        data: {
          status: "APPLIED",
          appliedAt: new Date(),
        },
      });

      if (claimed.count === 0) {
        throw new ApplyActionError("Already applied", 409);
      }

      let before: Record<string, unknown> | null = null;
      let after: Record<string, unknown> | null = null;
      let updatedSku: {
        id: string;
        sku: string;
        title: string;
        cost: Prisma.Decimal;
        currentPrice: Prisma.Decimal;
        status: string;
        updatedAt: Date;
      } | null = null;

      if (action.skuId) {
        const existingSku = await tx.sKU.findFirst({
          where: {
            id: action.skuId,
            workspaceId: workspace.id,
          },
        });

        if (!existingSku) {
          throw new ApplyActionError("SKU not found for action", 400);
        }

        before = toSkuSnapshot(existingSku);

        if (shouldUpdatePrice) {
          const workspaceSettings = await tx.workspaceSettings.findUnique({
            where: { workspaceId: workspace.id },
          });
          const settings = workspaceSettings
            ? {
                minMarginPercent: workspaceSettings.minMarginPercent.toNumber(),
                maxPriceChangePercent: workspaceSettings.maxPriceChangePercent.toNumber(),
                roundingMode: parseRoundingMode(workspaceSettings.roundingMode),
              }
            : DEFAULT_PRICING_SETTINGS;
          const guardrail = enforceGuardrails({
            cost: existingSku.cost.toNumber(),
            currentPrice: existingSku.currentPrice.toNumber(),
            suggestedPrice: suggestedPriceOriginal!,
            minMarginPct: settings.minMarginPercent,
            maxChangePct: settings.maxPriceChangePercent,
            roundingMode: settings.roundingMode,
          });

          if (guardrail.safetyStatus === "BLOCKED") {
            throw new ApplyActionError(`Action blocked by guardrails: ${guardrail.safetyReason ?? "Unsafe price change"}`, 409);
          }

          updatedSku = await tx.sKU.update({
            where: { id: existingSku.id },
            data: {
              currentPrice: new Prisma.Decimal(guardrail.suggestedPriceFinal),
            },
          });
          after = toSkuSnapshot(updatedSku);

          await tx.action.update({
            where: { id: action.id },
            data: {
              safetyStatus: guardrail.safetyStatus,
              safetyReason: guardrail.safetyReason ?? null,
              details: {
                ...(action.details as Prisma.JsonObject),
                suggestedPriceOriginal: guardrail.suggestedPriceOriginal,
                suggestedPriceFinal: guardrail.suggestedPriceFinal,
                guardrails: {
                  adjusted: guardrail.adjusted,
                  reasons: guardrail.reasons,
                },
              },
            },
          });
      } else {
        updatedSku = existingSku;
      }
    }

      let queuedNotifications: Array<{ id: string; type: string }> = [];
      if (action.type === "NOTIFY") {
        const message = buildNotifyMessage({
          workspace: {
            id: workspace.id,
            name: workspace.name,
          },
          action: {
            id: action.id,
            type: action.type,
            title: action.title,
            details: action.details,
          },
          sku: updatedSku
            ? {
                id: updatedSku.id,
                sku: updatedSku.sku,
                title: updatedSku.title,
              }
            : null,
        });
        queuedNotifications = await enqueueNotifications(tx, workspace.id, action.id, message);

        if (queuedNotifications.length > 0) {
          await tx.action.update({
            where: { id: action.id },
            data: {
              details: {
                ...(action.details as Prisma.JsonObject),
                notify: {
                  queued: true,
                  outboxIds: queuedNotifications.map((item) => item.id),
                },
              },
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          workspaceId: workspace.id,
          actorUserId: actor.userId,
          actorEmail: actor.user.email,
          actionId: action.id,
          entityType: action.skuId ? "SKU" : "ACTION",
          entityId: action.skuId ?? action.id,
          event: "ACTION_APPLIED",
          before: before ? (before as Prisma.InputJsonObject) : Prisma.JsonNull,
          after: after ? (after as Prisma.InputJsonObject) : Prisma.JsonNull,
        },
      });

      const appliedAction = await tx.action.findFirst({
        where: {
          id: action.id,
          workspaceId: workspace.id,
        },
        include: {
          sku: {
            select: {
              id: true,
              sku: true,
              title: true,
            },
          },
          rule: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return { action: appliedAction, sku: updatedSku, queuedNotifications };
    });
    await logTelemetry(prisma, workspace.id, "ACTION_APPLIED", {
      actionType: result.action?.type ?? action.type,
      skuId: result.action?.sku?.id ?? action.skuId ?? null,
      suggestedPriceFinal:
        result.sku && requiresPriceUpdate(action.type) ? result.sku.currentPrice.toNumber() : null,
    });
    for (const entry of result.queuedNotifications ?? []) {
      await logTelemetry(prisma, workspace.id, "NOTIFICATION_QUEUED", {
        outboxId: entry.id,
        type: entry.type,
      });
    }

    return ok({
      action: result.action
        ? {
            id: result.action.id,
            type: result.action.type,
            status: result.action.status,
            safetyStatus: result.action.safetyStatus,
            safetyReason: result.action.safetyReason,
            title: result.action.title,
            details: result.action.details,
            createdAt: result.action.createdAt.toISOString(),
            appliedAt: result.action.appliedAt?.toISOString() ?? null,
            sku: result.action.sku,
            rule: result.action.rule,
          }
        : null,
      sku: result.sku
        ? {
            id: result.sku.id,
            sku: result.sku.sku,
            title: result.sku.title,
            cost: result.sku.cost.toNumber(),
            currentPrice: result.sku.currentPrice.toNumber(),
            status: result.sku.status,
            updatedAt: result.sku.updatedAt.toISOString(),
          }
        : null,
      notificationsQueued: result.queuedNotifications?.map((item) => item.id) ?? [],
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    if (error instanceof ApplyActionError) {
      if (error.status === 404) return err("NOT_FOUND", error.message, 404);
      if (error.status === 409) return err("CONFLICT", error.message, 409);
      return err("BAD_REQUEST", error.message, 400);
    }
    return err("INTERNAL", error instanceof Error ? error.message : "Failed to apply action", 500);
  }
}
