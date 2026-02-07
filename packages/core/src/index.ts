export { PHAROS_CORE_VERSION } from "./version";
export {
  calcMarginPercent,
  calcMarginValue,
  calcDeltaPercent,
  round2,
  applyRounding,
  clampPriceChange,
  enforceMinMargin,
  enforceGuardrails,
} from "./domain/pricing";
export {
  EVENT_TYPES,
  eventPayloadSchemas,
  eventTypeSchema,
  parseEventInput,
} from "./domain/events";
export {
  actionTypeSchema,
  actionTemplateSchema,
  conditionSchema,
  createRuleSchema,
  updateRuleSchema,
} from "./domain/rules";
export { getByPath } from "./engine/path";
export { evaluateCondition } from "./engine/evaluateCondition";
export { runRules } from "./engine/runRules";
export type {
  EventType,
  CompetitorPriceDropPayload,
  CostIncreasePayload,
  StockLowPayload,
} from "./domain/events";
export type { ActionTemplate, ConditionNode } from "./domain/rules";
export type { SuggestedAction } from "./engine/runRules";
export type { RoundingMode } from "./domain/pricing";
