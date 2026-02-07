import type { Prisma } from "@pharos/db";

function asRecord(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

export function getEventSummary(type: string, payload: Prisma.JsonValue) {
  const data = asRecord(payload);
  if (!data) return "Signal received";

  if (type === "COMPETITOR_PRICE_DROP") {
    const oldPrice = toNumber(data.oldPrice);
    const newPrice = toNumber(data.newPrice);
    if (oldPrice !== null && newPrice !== null) {
      return `Competitor undercut: ${oldPrice} -> ${newPrice}`;
    }
    return "Competitor price changed";
  }

  if (type === "COST_INCREASE") {
    const oldCost = toNumber(data.oldCost);
    const newCost = toNumber(data.newCost);
    if (oldCost !== null && newCost !== null) {
      return `Cost increased: ${oldCost} -> ${newCost}`;
    }
    return "Cost increased";
  }

  if (type === "STOCK_LOW") {
    const available = toNumber(data.available);
    const threshold = toNumber(data.threshold);
    if (available !== null && threshold !== null) {
      return `Stock low: available ${available} < threshold ${threshold}`;
    }
    return "Stock low signal";
  }

  return "Signal received";
}

export function getActionSummary(title: string) {
  return title;
}

export function getAuditSummary(event: string) {
  if (event === "ACTION_APPLIED") return "Applied action updated SKU price";
  return event;
}
