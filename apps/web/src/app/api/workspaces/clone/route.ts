import { ZodError, z } from "zod";
import { Prisma } from "@pharos/db";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth";
import { err, ok } from "@/lib/apiResponse";
import { clearClientDemoModeCookie } from "@/lib/demoMode";
import { DEFAULT_PRICING_SETTINGS } from "@/lib/settings";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace, setWorkspaceCookie } from "@/lib/tenant";
import { requireOwner } from "@/lib/rbac";
import { workspaceCloneSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let payload: z.infer<typeof workspaceCloneSchema>;
  try {
    const current = await getCurrentWorkspace();
    const actor = await requireOwner(current.workspace.id);
    payload = workspaceCloneSchema.parse(await request.json());

    if (payload.includeData.snapshots && (!payload.includeData.skus || !payload.includeData.competitors)) {
      return err("BAD_REQUEST", "Snapshots clone requires SKUs and Competitors toggles enabled", 400);
    }

    const accessibleWorkspaces = await prisma.membership.findMany({
      where: { userId: actor.userId },
      select: { workspaceId: true },
    });
    const accessible = new Set(accessibleWorkspaces.map((item) => item.workspaceId));
    if (!accessible.has(payload.sourceWorkspaceId)) {
      return err("NOT_FOUND", "Source workspace not found", 404);
    }

    const cloneResult = await prisma.$transaction(async (tx) => {
      const sourceWorkspace = await tx.workspace.findUnique({
        where: { id: payload.sourceWorkspaceId },
        select: { id: true, name: true },
      });
      if (!sourceWorkspace) {
        throw new Error("SOURCE_NOT_FOUND");
      }

      const newWorkspace = await tx.workspace.create({
        data: { name: payload.newWorkspaceName },
        select: { id: true },
      });
      await tx.workspaceSubscription.create({
        data: {
          workspaceId: newWorkspace.id,
          plan: "STARTER",
        },
      });
      await tx.membership.create({
        data: {
          userId: actor.userId,
          workspaceId: newWorkspace.id,
          role: "OWNER",
        },
      });

      const sourceSettings = await tx.workspaceSettings.findUnique({
        where: { workspaceId: payload.sourceWorkspaceId },
      });

      if (sourceSettings) {
        await tx.workspaceSettings.create({
          data: {
            workspaceId: newWorkspace.id,
            minMarginPercent: sourceSettings.minMarginPercent,
            maxPriceChangePercent: sourceSettings.maxPriceChangePercent,
            roundingMode: sourceSettings.roundingMode,
          },
        });
      } else {
        await tx.workspaceSettings.create({
          data: {
            workspaceId: newWorkspace.id,
            minMarginPercent: DEFAULT_PRICING_SETTINGS.minMarginPercent,
            maxPriceChangePercent: DEFAULT_PRICING_SETTINGS.maxPriceChangePercent,
            roundingMode: DEFAULT_PRICING_SETTINGS.roundingMode,
          },
        });
      }

      const sourceShopifySettings = await tx.workspaceShopifySettings.findUnique({
        where: { workspaceId: payload.sourceWorkspaceId },
      });
      await tx.workspaceShopifySettings.create({
        data: {
          workspaceId: newWorkspace.id,
          shopDomain: sourceShopifySettings?.shopDomain ?? null,
          adminAccessToken: sourceShopifySettings?.adminAccessToken ?? null,
          priceUpdateMode: sourceShopifySettings?.priceUpdateMode ?? "DRY_RUN",
        },
      });

      const sourceNotificationSettings = await tx.workspaceNotificationSettings.findUnique({
        where: { workspaceId: payload.sourceWorkspaceId },
      });
      await tx.workspaceNotificationSettings.create({
        data: {
          workspaceId: newWorkspace.id,
          emailRecipients: sourceNotificationSettings?.emailRecipients ?? null,
          webhookUrl: sourceNotificationSettings?.webhookUrl ?? null,
          notifyMode: sourceNotificationSettings?.notifyMode ?? "DRY_RUN",
        },
      });

      const sourceRules = await tx.rule.findMany({
        where: { workspaceId: payload.sourceWorkspaceId },
        orderBy: { createdAt: "asc" },
      });

      if (sourceRules.length > 0) {
        await tx.rule.createMany({
          data: sourceRules.map((rule) => ({
            workspaceId: newWorkspace.id,
            name: rule.name,
            eventType: rule.eventType,
            enabled: rule.enabled,
            condition: (rule.condition ?? {}) as Prisma.InputJsonValue,
            actionTemplate: (rule.actionTemplate ?? {}) as Prisma.InputJsonValue,
          })),
        });
      }

      let clonedSkus = 0;
      let clonedCompetitors = 0;
      let clonedSnapshots = 0;

      if (payload.includeData.skus) {
        const sourceSkus = await tx.sKU.findMany({
          where: { workspaceId: payload.sourceWorkspaceId },
          orderBy: { createdAt: "asc" },
        });

        if (sourceSkus.length > 0) {
          await tx.sKU.createMany({
            data: sourceSkus.map((sku) => ({
              workspaceId: newWorkspace.id,
              title: sku.title,
              sku: sku.sku,
              cost: sku.cost,
              currentPrice: sku.currentPrice,
              status: sku.status,
              shopifyProductId: sku.shopifyProductId,
              shopifyVariantId: sku.shopifyVariantId,
            })),
          });
          clonedSkus = sourceSkus.length;
        }
      }

      if (payload.includeData.competitors) {
        const sourceCompetitors = await tx.competitor.findMany({
          where: { workspaceId: payload.sourceWorkspaceId },
          orderBy: { createdAt: "asc" },
        });

        if (sourceCompetitors.length > 0) {
          await tx.competitor.createMany({
            data: sourceCompetitors.map((competitor) => ({
              workspaceId: newWorkspace.id,
              name: competitor.name,
              domain: competitor.domain,
              currency: competitor.currency,
            })),
          });
          clonedCompetitors = sourceCompetitors.length;
        }
      }

      if (payload.includeData.snapshots) {
        const [sourceSkus, sourceCompetitors, targetSkus, targetCompetitors, sourceSnapshots] = await Promise.all([
          tx.sKU.findMany({
            where: { workspaceId: payload.sourceWorkspaceId },
            select: { id: true, sku: true },
          }),
          tx.competitor.findMany({
            where: { workspaceId: payload.sourceWorkspaceId },
            select: { id: true, name: true },
          }),
          tx.sKU.findMany({
            where: { workspaceId: newWorkspace.id },
            select: { id: true, sku: true },
          }),
          tx.competitor.findMany({
            where: { workspaceId: newWorkspace.id },
            select: { id: true, name: true },
          }),
          tx.competitorSnapshot.findMany({
            where: { workspaceId: payload.sourceWorkspaceId },
            select: {
              skuId: true,
              competitorId: true,
              price: true,
              capturedAt: true,
              source: true,
            },
            orderBy: { capturedAt: "asc" },
          }),
        ]);

        const sourceSkuById = new Map(sourceSkus.map((sku) => [sku.id, sku.sku]));
        const sourceCompetitorById = new Map(sourceCompetitors.map((item) => [item.id, item.name]));
        const targetSkuByCode = new Map(targetSkus.map((sku) => [sku.sku, sku.id]));
        const targetCompetitorByName = new Map(targetCompetitors.map((item) => [item.name, item.id]));

        const snapshotData = sourceSnapshots
          .map((snapshot) => {
            const skuCode = sourceSkuById.get(snapshot.skuId);
            const competitorName = sourceCompetitorById.get(snapshot.competitorId);
            if (!skuCode || !competitorName) return null;
            const mappedSkuId = targetSkuByCode.get(skuCode);
            const mappedCompetitorId = targetCompetitorByName.get(competitorName);
            if (!mappedSkuId || !mappedCompetitorId) return null;
            return {
              workspaceId: newWorkspace.id,
              skuId: mappedSkuId,
              competitorId: mappedCompetitorId,
              price: snapshot.price,
              capturedAt: snapshot.capturedAt,
              source: snapshot.source,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        if (snapshotData.length > 0) {
          const created = await tx.competitorSnapshot.createMany({ data: snapshotData });
          clonedSnapshots = created.count;
        }
      }

      return {
        newWorkspaceId: newWorkspace.id,
        cloned: {
          rules: sourceRules.length,
          skus: clonedSkus,
          competitors: clonedCompetitors,
          snapshots: clonedSnapshots,
        },
      };
    });

    await logTelemetry(prisma, cloneResult.newWorkspaceId, "WORKSPACE_CLONED", {
      sourceWorkspaceId: payload.sourceWorkspaceId,
      newWorkspaceId: cloneResult.newWorkspaceId,
      includeData: payload.includeData,
    });

    const response = ok({ newWorkspaceId: cloneResult.newWorkspaceId, cloned: cloneResult.cloned }, 201);
    if (payload.setAsCurrent) {
      setWorkspaceCookie(response, cloneResult.newWorkspaceId);
    }
    if (payload.exitClientDemoMode) {
      clearClientDemoModeCookie(response);
    }

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    if (error instanceof ZodError) {
      return err("BAD_REQUEST", "Invalid clone payload", 400);
    }
    if (error instanceof Error && error.message === "SOURCE_NOT_FOUND") {
      return err("NOT_FOUND", "Source workspace not found", 404);
    }
    return err("INTERNAL", error instanceof Error ? error.message : "Failed to clone workspace", 500);
  }
}
