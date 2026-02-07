"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { withCsrfHeaders } from "@/lib/csrf-client";

type Props = {
  skuId: string;
  initialProductId: string | null;
  initialVariantId: string | null;
};

export function SkuShopifyMappingForm({ skuId, initialProductId, initialVariantId }: Props) {
  const router = useRouter();
  const [shopifyProductId, setShopifyProductId] = useState(initialProductId ?? "");
  const [shopifyVariantId, setShopifyVariantId] = useState(initialVariantId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/skus/${skuId}`, {
        method: "PATCH",
        headers: withCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          shopifyProductId: shopifyProductId.trim() || null,
          shopifyVariantId: shopifyVariantId.trim() || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to save Shopify mapping");
      }
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save Shopify mapping");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="sku-form" onSubmit={onSubmit}>
      <label className="field">
        <span>Shopify Product ID (optional)</span>
        <input value={shopifyProductId} onChange={(event) => setShopifyProductId(event.target.value)} placeholder="gid://shopify/Product/..." />
      </label>
      <label className="field">
        <span>Shopify Variant ID (required for push)</span>
        <input value={shopifyVariantId} onChange={(event) => setShopifyVariantId(event.target.value)} placeholder="gid://shopify/ProductVariant/... or numeric" />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <Button type="submit" loading={pending} loadingText="Saving...">Save Shopify Mapping</Button>
    </form>
  );
}
