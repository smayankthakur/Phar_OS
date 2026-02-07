import { Prisma } from "@pharos/db";
import { enforceGuardrails, parseEventInput, runRules, type ActionTemplate, type ConditionNode, type EventType } from "@pharos/core";
import { prisma } from "@/lib/prisma";
import { getPricingSettings } from "@/lib/settings";
import { getCurrentWorkspace } from "@/lib/tenant";

export class RuleRunnerError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function createEventAndRecommendations(input: {
  type: EventType;
  payload: unknown;
  skuId?: string;
}) {
  const { workspace } = await getCurrentWorkspace();

  const parsed = parseEventInput({
    type: input.type,
    payload: input.payload,
  });

  const payloadSkuId = parsed.payload.skuId;
  const resolvedSkuId = input.skuId ?? payloadSkuId;

  if (resolvedSkuId !== payloadSkuId) {
    throw new RuleRunnerError("skuId mismatch between payload and body", 400);
  }

  const sku = await prisma.sKU.findFirst({
    where: {
      id: resolvedSkuId,
      workspaceId: workspace.id,
    },
  });

  if (!sku) {
    throw new RuleRunnerError("Not found", 404);
  }

  const event = await prisma.event.create({
    data: {
      workspaceId: workspace.id,
      skuId: sku.id,
      type: parsed.type,
      payload: parsed.payload as Prisma.JsonObject,
    },
  });

  const rules = await prisma.rule.findMany({
    where: {
      workspaceId: workspace.id,
      enabled: true,
      eventType: parsed.type,
    },
    orderBy: { createdAt: "asc" },
  });

  const recommendations = runRules({
    event: {
      type: parsed.type,
      payload: parsed.payload as Record<string, unknown>,
    },
    sku: {
      id: sku.id,
      currentPrice: sku.currentPrice.toNumber(),
      cost: sku.cost.toNumber(),
    },
    rules: rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      condition: rule.condition as ConditionNode,
      actionTemplate: rule.actionTemplate as ActionTemplate,
    })),
  });

  const pricingSettings = await getPricingSettings(workspace.id);

  const actions = recommendations.length
    ? await prisma.$transaction(
        recommendations.map((recommendation) => {
          const isPriceAction = recommendation.type === "PRICE_MATCH" || recommendation.type === "PRICE_INCREASE";
          const suggestedRaw = Number((recommendation.details as Record<string, unknown>).suggestedPrice ?? sku.currentPrice.toNumber());

          const guardrail = isPriceAction
            ? enforceGuardrails({
                cost: sku.cost.toNumber(),
                currentPrice: sku.currentPrice.toNumber(),
                suggestedPrice: suggestedRaw,
                minMarginPct: pricingSettings.minMarginPercent,
                maxChangePct: pricingSettings.maxPriceChangePercent,
                roundingMode: pricingSettings.roundingMode,
              })
            : {
                safetyStatus: "OK" as const,
                suggestedPriceOriginal: suggestedRaw,
                suggestedPriceFinal: suggestedRaw,
                adjusted: false,
                reasons: [] as string[],
              };

          return prisma.action.create({
            data: {
              workspaceId: workspace.id,
              eventId: event.id,
              skuId: sku.id,
              type: recommendation.type,
              status: "RECOMMENDED",
              title: recommendation.title,
              safetyStatus: guardrail.safetyStatus,
              safetyReason: guardrail.safetyReason ?? null,
              details: {
                ...recommendation.details,
                reason: recommendation.reason,
                suggestedPriceOriginal: guardrail.suggestedPriceOriginal,
                suggestedPriceFinal: guardrail.suggestedPriceFinal,
                guardrails: {
                  adjusted: guardrail.adjusted,
                  reasons: guardrail.reasons,
                },
              },
              ruleId: recommendation.ruleId,
            },
          });
        }),
      )
    : [];

  return {
    workspace,
    event,
    actions,
  };
}
