import type { ConditionNode } from "../domain/rules";
import { getByPath } from "./path";

type EvalContext = {
  payload: Record<string, unknown>;
  sku?: Record<string, unknown>;
};

function toComparable(value: unknown): string | number | boolean | null | undefined {
  if (["number", "string", "boolean"].includes(typeof value)) {
    return value as string | number | boolean;
  }
  return value as null | undefined;
}

function resolveOperand(raw: number | string, context: EvalContext): unknown {
  if (typeof raw === "number") {
    return raw;
  }

  if (raw.startsWith("payload.")) {
    return getByPath({ payload: context.payload, sku: context.sku }, raw);
  }

  if (raw.startsWith("sku.")) {
    return getByPath({ payload: context.payload, sku: context.sku }, raw);
  }

  return raw;
}

function compare(op: "lt" | "lte" | "gt" | "gte" | "eq" | "neq", left: unknown, right: unknown): boolean {
  const l = toComparable(left);
  const r = toComparable(right);

  if (op === "eq") return l === r;
  if (op === "neq") return l !== r;

  if (typeof l !== "number" || typeof r !== "number") {
    return false;
  }

  if (op === "lt") return l < r;
  if (op === "lte") return l <= r;
  if (op === "gt") return l > r;
  return l >= r;
}

export function evaluateCondition(condition: ConditionNode, context: EvalContext): boolean {
  if ("rules" in condition) {
    if (condition.op === "and") {
      return condition.rules.every((rule) => evaluateCondition(rule, context));
    }
    return condition.rules.some((rule) => evaluateCondition(rule, context));
  }

  const left = resolveOperand(condition.left, context);
  const right = resolveOperand(condition.right, context);
  return compare(condition.op, left, right);
}
