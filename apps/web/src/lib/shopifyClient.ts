import { z } from "zod";
import { prisma } from "@/lib/prisma";

const priceUpdateModeSchema = z.enum(["DRY_RUN", "LIVE"]);

export type ShopifySettingsDTO = {
  id: string;
  workspaceId: string;
  shopDomain: string | null;
  adminAccessTokenMasked: string | null;
  priceUpdateMode: "DRY_RUN" | "LIVE";
  configured: boolean;
  createdAt: string;
  updatedAt: string;
};

export function maskToken(token: string | null | undefined) {
  if (!token) return null;
  const suffix = token.slice(-4);
  return `shpat_****${suffix}`;
}

export function normalizeShopDomain(domain: string | null | undefined) {
  if (!domain) return null;
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function parsePriceUpdateMode(value: string | null | undefined): "DRY_RUN" | "LIVE" {
  const parsed = priceUpdateModeSchema.safeParse(value ?? "DRY_RUN");
  return parsed.success ? parsed.data : "DRY_RUN";
}

export async function ensureWorkspaceShopifySettings(workspaceId: string) {
  return prisma.workspaceShopifySettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      priceUpdateMode: "DRY_RUN",
    },
    update: {},
  });
}

export async function getShopifySettings(workspaceId: string) {
  const settings = await ensureWorkspaceShopifySettings(workspaceId);
  return {
    id: settings.id,
    workspaceId: settings.workspaceId,
    shopDomain: normalizeShopDomain(settings.shopDomain),
    adminAccessToken: settings.adminAccessToken,
    priceUpdateMode: parsePriceUpdateMode(settings.priceUpdateMode),
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}

export function isShopifyConfigured(settings: { shopDomain: string | null; adminAccessToken: string | null }) {
  return Boolean(settings.shopDomain && settings.adminAccessToken);
}

function getShopifyApiVersion() {
  return process.env.SHOPIFY_API_VERSION ?? "2025-01";
}

export function normalizeVariantGid(variantId: string) {
  if (variantId.startsWith("gid://")) return variantId;
  return `gid://shopify/ProductVariant/${variantId}`;
}

export async function shopifyFetch<T>(settings: { shopDomain: string; adminAccessToken: string }, query: string, variables?: Record<string, unknown>) {
  const endpoint = `https://${settings.shopDomain}/admin/api/${getShopifyApiVersion()}/graphql.json`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": settings.adminAccessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const body = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };

  if (body.errors?.length) {
    throw new Error(body.errors.map((item) => item.message ?? "Unknown Shopify error").join("; "));
  }

  return body.data;
}

export function toShopifySettingsDTO(item: {
  id: string;
  workspaceId: string;
  shopDomain: string | null;
  adminAccessToken: string | null;
  priceUpdateMode: string;
  createdAt: Date;
  updatedAt: Date;
}): ShopifySettingsDTO {
  const mode = parsePriceUpdateMode(item.priceUpdateMode);
  const normalizedDomain = normalizeShopDomain(item.shopDomain);
  return {
    id: item.id,
    workspaceId: item.workspaceId,
    shopDomain: normalizedDomain,
    adminAccessTokenMasked: maskToken(item.adminAccessToken),
    priceUpdateMode: mode,
    configured: Boolean(normalizedDomain && item.adminAccessToken),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
