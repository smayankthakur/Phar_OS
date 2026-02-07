import Stripe from "stripe";
import { type PlanTier } from "@/lib/plans";

let stripeClient: Stripe | null = null;

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getStripe() {
  if (stripeClient) return stripeClient;
  stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
    apiVersion: "2026-01-28.clover",
  });
  return stripeClient;
}

const PLAN_PRICE_ENV: Record<Exclude<PlanTier, "ENTERPRISE"> | "ENTERPRISE", string> = {
  STARTER: "STRIPE_STARTER_PRICE_ID",
  PRO: "STRIPE_PRO_PRICE_ID",
  AGENCY: "STRIPE_AGENCY_PRICE_ID",
  ENTERPRISE: "STRIPE_ENTERPRISE_PRICE_ID",
};

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.PHAROS_BASE_URL ?? "http://localhost:3000";
}

export function priceIdForPlan(plan: PlanTier) {
  const envName = PLAN_PRICE_ENV[plan];
  const value = process.env[envName];
  if (!value) {
    throw new Error(`Missing Stripe price id for ${plan} (${envName})`);
  }
  return value;
}

export function planForPriceId(priceId: string): PlanTier | null {
  const entries = Object.entries(PLAN_PRICE_ENV) as Array<[PlanTier, string]>;
  for (const [plan, envName] of entries) {
    const configured = process.env[envName];
    if (configured && configured === priceId) {
      return plan;
    }
  }
  return null;
}

export function toBillingStatus(status: string): "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" {
  if (status === "active") return "ACTIVE";
  if (status === "trialing") return "TRIALING";
  if (status === "canceled") return "CANCELED";
  return "PAST_DUE";
}
