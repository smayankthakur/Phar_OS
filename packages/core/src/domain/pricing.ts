export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcMarginPercent(cost: number, price: number): number {
  if (price <= 0) {
    return 0;
  }

  const margin = ((price - cost) / price) * 100;
  return round2(margin);
}

export function calcMarginValue(cost: number, price: number): number {
  return round2(price - cost);
}

export function calcDeltaPercent(base: number, other: number): number {
  if (base <= 0) {
    return 0;
  }

  return round2(((other - base) / base) * 100);
}

export type RoundingMode = "NONE" | "NEAREST_1" | "NEAREST_5" | "NEAREST_10";

function stepByMode(mode: RoundingMode): number {
  if (mode === "NEAREST_5") return 5;
  if (mode === "NEAREST_10") return 10;
  return 1;
}

function roundUpToMode(price: number, mode: RoundingMode): number {
  if (mode === "NONE") return round2(price);
  const step = stepByMode(mode);
  return round2(Math.ceil(price / step) * step);
}

function roundDownToMode(price: number, mode: RoundingMode): number {
  if (mode === "NONE") return round2(price);
  const step = stepByMode(mode);
  return round2(Math.floor(price / step) * step);
}

export function applyRounding(price: number, mode: RoundingMode): number {
  if (mode === "NONE") return round2(price);
  const step = stepByMode(mode);
  return round2(Math.round(price / step) * step);
}

export function clampPriceChange(current: number, suggested: number, maxPct: number): { price: number; adjusted: boolean; reason?: string } {
  if (current <= 0 || maxPct < 0) {
    return { price: round2(suggested), adjusted: false };
  }

  const minAllowed = current * (1 - maxPct / 100);
  const maxAllowed = current * (1 + maxPct / 100);
  const clamped = Math.max(minAllowed, Math.min(maxAllowed, suggested));
  const adjusted = clamped !== suggested;

  return {
    price: round2(clamped),
    adjusted,
    reason: adjusted ? "Adjusted to max price change guardrail" : undefined,
  };
}

export function enforceMinMargin(
  cost: number,
  suggested: number,
  minMarginPct: number,
): { price: number; adjusted: boolean; blocked: boolean; reason?: string } {
  if (minMarginPct >= 100) {
    return { price: round2(suggested), adjusted: false, blocked: true, reason: "Invalid min margin percent" };
  }

  const denominator = 1 - minMarginPct / 100;
  const minPriceForMargin = denominator > 0 ? cost / denominator : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(minPriceForMargin)) {
    return { price: round2(suggested), adjusted: false, blocked: true, reason: "Invalid min margin requirement" };
  }

  if (suggested >= minPriceForMargin) {
    return { price: round2(suggested), adjusted: false, blocked: false };
  }

  return {
    price: round2(minPriceForMargin),
    adjusted: true,
    blocked: false,
    reason: "Raised to satisfy minimum margin",
  };
}

export function enforceGuardrails(input: {
  cost: number;
  currentPrice: number;
  suggestedPrice: number;
  minMarginPct: number;
  maxChangePct: number;
  roundingMode: RoundingMode;
}): {
  safetyStatus: "OK" | "BLOCKED";
  safetyReason?: string;
  suggestedPriceOriginal: number;
  suggestedPriceFinal: number;
  adjusted: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const original = round2(input.suggestedPrice);

  const minAllowed = input.currentPrice * (1 - input.maxChangePct / 100);
  const maxAllowed = input.currentPrice * (1 + input.maxChangePct / 100);

  let candidate = original;

  const clamp = clampPriceChange(input.currentPrice, candidate, input.maxChangePct);
  if (clamp.adjusted && clamp.reason) reasons.push(clamp.reason);
  candidate = clamp.price;

  const margin = enforceMinMargin(input.cost, candidate, input.minMarginPct);
  if (margin.blocked) {
    return {
      safetyStatus: "BLOCKED",
      safetyReason: margin.reason,
      suggestedPriceOriginal: original,
      suggestedPriceFinal: round2(candidate),
      adjusted: candidate !== original,
      reasons: reasons.concat(margin.reason ?? []),
    };
  }

  if (margin.adjusted && margin.reason) reasons.push(margin.reason);
  candidate = margin.price;

  if (candidate > maxAllowed) {
    return {
      safetyStatus: "BLOCKED",
      safetyReason: "Cannot satisfy margin within max price change guardrail",
      suggestedPriceOriginal: original,
      suggestedPriceFinal: round2(candidate),
      adjusted: candidate !== original,
      reasons: reasons.concat("Cannot satisfy margin within max price change guardrail"),
    };
  }

  let rounded = applyRounding(candidate, input.roundingMode);
  if (rounded !== candidate) reasons.push("Rounded by workspace setting");

  if (rounded < minAllowed) {
    const raised = roundUpToMode(minAllowed, input.roundingMode);
    if (raised <= maxAllowed) {
      rounded = raised;
      reasons.push("Adjusted after rounding to stay within price change guardrail");
    }
  }

  const marginAfterRounding = enforceMinMargin(input.cost, rounded, input.minMarginPct);
  if (!marginAfterRounding.blocked && marginAfterRounding.adjusted) {
    const raised = roundUpToMode(marginAfterRounding.price, input.roundingMode);
    if (raised <= maxAllowed) {
      rounded = raised;
      reasons.push("Adjusted after rounding to satisfy minimum margin");
    } else {
      return {
        safetyStatus: "BLOCKED",
        safetyReason: "Cannot satisfy minimum margin after rounding and max-change guardrail",
        suggestedPriceOriginal: original,
        suggestedPriceFinal: round2(rounded),
        adjusted: round2(rounded) !== original,
        reasons: reasons.concat("Cannot satisfy minimum margin after rounding and max-change guardrail"),
      };
    }
  }

  if (rounded > maxAllowed) {
    const lowered = roundDownToMode(maxAllowed, input.roundingMode);
    if (lowered >= input.cost && calcMarginPercent(input.cost, lowered) >= input.minMarginPct) {
      rounded = lowered;
      reasons.push("Adjusted after rounding to stay within max price change");
    } else {
      return {
        safetyStatus: "BLOCKED",
        safetyReason: "Cannot satisfy max price change guardrail after rounding",
        suggestedPriceOriginal: original,
        suggestedPriceFinal: round2(rounded),
        adjusted: round2(rounded) !== original,
        reasons: reasons.concat("Cannot satisfy max price change guardrail after rounding"),
      };
    }
  }

  const final = round2(rounded);
  return {
    safetyStatus: "OK",
    suggestedPriceOriginal: original,
    suggestedPriceFinal: final,
    adjusted: final !== original,
    reasons,
  };
}
