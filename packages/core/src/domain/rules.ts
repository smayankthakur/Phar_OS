import { z } from "zod";
import { eventTypeSchema } from "./events";

export const actionTypeSchema = z.enum(["PRICE_MATCH", "PRICE_INCREASE", "NOTIFY"]);

const comparisonOpSchema = z.enum(["lt", "lte", "gt", "gte", "eq", "neq"]);

const comparisonConditionSchema = z.object({
  op: comparisonOpSchema,
  left: z.string().min(1),
  right: z.union([z.number(), z.string().min(1)]),
});

export type ComparisonCondition = z.infer<typeof comparisonConditionSchema>;

export type ConditionNode =
  | ComparisonCondition
  | {
      op: "and" | "or";
      rules: ConditionNode[];
    };

export const conditionSchema: z.ZodType<ConditionNode> = z.lazy(() =>
  z.union([
    comparisonConditionSchema,
    z.object({
      op: z.enum(["and", "or"]),
      rules: z.array(conditionSchema).min(1),
    }),
  ]),
);

export const actionTemplateSchema = z.object({
  type: actionTypeSchema,
  params: z.record(z.any()).default({}),
});

export type ActionTemplate = z.infer<typeof actionTemplateSchema>;

export const createRuleSchema = z.object({
  name: z.string().min(2),
  eventType: eventTypeSchema,
  enabled: z.boolean().default(true),
  condition: conditionSchema,
  actionTemplate: actionTemplateSchema,
});

export const updateRuleSchema = z
  .object({
    name: z.string().min(2).optional(),
    eventType: eventTypeSchema.optional(),
    enabled: z.boolean().optional(),
    condition: conditionSchema.optional(),
    actionTemplate: actionTemplateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
