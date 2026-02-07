import { Prisma } from "@pharos/db";

export function safeNumberFromDecimal(value: unknown): number {
  if (typeof value === "number") return value;
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: unknown }).toNumber === "function") {
    return ((value as { toNumber: () => number }).toNumber());
  }
  return Number(value ?? 0);
}

export function formatMoney(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatTs(ts: string | Date): { label: string; title: string } {
  const date = ts instanceof Date ? ts : new Date(ts);
  const now = Date.now();
  const deltaMs = now - date.getTime();
  const absMs = Math.abs(deltaMs);

  let label = "just now";
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs >= day) {
    const days = Math.round(absMs / day);
    label = `${days}d ${deltaMs >= 0 ? "ago" : "from now"}`;
  } else if (absMs >= hour) {
    const hours = Math.round(absMs / hour);
    label = `${hours}h ${deltaMs >= 0 ? "ago" : "from now"}`;
  } else if (absMs >= minute) {
    const mins = Math.round(absMs / minute);
    label = `${mins}m ${deltaMs >= 0 ? "ago" : "from now"}`;
  }

  return {
    label,
    title: date.toLocaleString(),
  };
}
