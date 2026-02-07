import { round2 } from "../domain/pricing";
import { evaluateCondition } from "./evaluateCondition";
import type { ActionTemplate, ConditionNode } from "../domain/rules";
import type { EventType } from "../domain/events";

type RunRulesInput = {
  event: {
    type: EventType;
    payload: Record<string, unknown>;
  };
  sku?: {
    id: string;
    currentPrice: number;
    cost: number;
  };
  rules: Array<{
    id: string;
    name: string;
    condition: ConditionNode;
    actionTemplate: ActionTemplate;
  }>;
};

export type SuggestedAction = {
  type: "PRICE_MATCH" | "PRICE_INCREASE" | "NOTIFY";
  title: string;
  details: Record<string, unknown>;
  ruleId: string;
  reason: string;
};

function buildAction(rule: RunRulesInput["rules"][number], event: RunRulesInput["event"], sku?: RunRulesInput["sku"]): SuggestedAction {
  const type = rule.actionTemplate.type;

  if (type === "PRICE_MATCH") {
    const newPrice = Number(event.payload.newPrice ?? sku?.currentPrice ?? 0);
    const suggestedPrice = round2(Math.min(newPrice, sku?.currentPrice ?? newPrice));
    return {
      type,
      title: `Match competitor price to Rs ${suggestedPrice.toFixed(2)}`,
      details: {
        suggestedPrice,
        reason: "Competitor undercut",
        competitorId: event.payload.competitorId,
        oldPrice: event.payload.oldPrice,
        newPrice: event.payload.newPrice,
      },
      ruleId: rule.id,
      reason: rule.name,
    };
  }

  if (type === "PRICE_INCREASE") {
    const oldCost = Number(event.payload.oldCost ?? sku?.cost ?? 0);
    const newCost = Number(event.payload.newCost ?? oldCost);
    const deltaCost = round2(newCost - oldCost);
    const suggestedPrice = round2((sku?.currentPrice ?? 0) + deltaCost);

    return {
      type,
      title: `Increase price to protect margin: Rs ${suggestedPrice.toFixed(2)}`,
      details: {
        suggestedPrice,
        deltaCost,
        oldCost,
        newCost,
      },
      ruleId: rule.id,
      reason: rule.name,
    };
  }

  return {
    type,
    title: "Low stock alert",
    details: {
      available: event.payload.available,
      threshold: event.payload.threshold,
    },
    ruleId: rule.id,
    reason: rule.name,
  };
}

export function runRules(input: RunRulesInput): SuggestedAction[] {
  const context = {
    payload: input.event.payload,
    sku: input.sku
      ? {
          currentPrice: input.sku.currentPrice,
          cost: input.sku.cost,
        }
      : undefined,
  };

  const matchedRules = input.rules.filter((rule) => evaluateCondition(rule.condition, context));
  return matchedRules.map((rule) => buildAction(rule, input.event, input.sku));
}
