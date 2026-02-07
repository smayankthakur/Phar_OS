import { z } from "zod";

export const EVENT_TYPES = ["COMPETITOR_PRICE_DROP", "COST_INCREASE", "STOCK_LOW"] as const;

export type EventType = (typeof EVENT_TYPES)[number];

const competitorPriceDropSchema = z.object({
  skuId: z.string().min(1),
  competitorId: z.string().min(1),
  oldPrice: z.number().positive(),
  newPrice: z.number().positive(),
  capturedAt: z.string().datetime().optional(),
});

const costIncreaseSchema = z.object({
  skuId: z.string().min(1),
  oldCost: z.number().positive(),
  newCost: z.number().positive(),
  reason: z.string().min(1).optional(),
});

const stockLowSchema = z.object({
  skuId: z.string().min(1),
  available: z.number().nonnegative(),
  threshold: z.number().nonnegative(),
});

export const eventPayloadSchemas = {
  COMPETITOR_PRICE_DROP: competitorPriceDropSchema,
  COST_INCREASE: costIncreaseSchema,
  STOCK_LOW: stockLowSchema,
} as const;

export type CompetitorPriceDropPayload = z.infer<typeof competitorPriceDropSchema>;
export type CostIncreasePayload = z.infer<typeof costIncreaseSchema>;
export type StockLowPayload = z.infer<typeof stockLowSchema>;

export type EventPayloadByType = {
  COMPETITOR_PRICE_DROP: CompetitorPriceDropPayload;
  COST_INCREASE: CostIncreasePayload;
  STOCK_LOW: StockLowPayload;
};

export function parseEventInput<T extends EventType>(input: { type: T; payload: unknown }): {
  type: T;
  payload: EventPayloadByType[T];
} {
  const schema = eventPayloadSchemas[input.type];
  const parsed = schema.parse(input.payload);
  return {
    type: input.type,
    payload: parsed as EventPayloadByType[T],
  };
}

export const eventTypeSchema = z.enum(EVENT_TYPES);
