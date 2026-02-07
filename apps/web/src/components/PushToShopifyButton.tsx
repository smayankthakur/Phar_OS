"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type Props = {
  skuId: string;
  actionId?: string;
  newPrice: number;
  disabled?: boolean;
};

export function PushToShopifyButton({ skuId, actionId, newPrice, disabled = false }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPush = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/shopify/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skuId, actionId, newPrice }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to queue Shopify job");
      }

      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to queue Shopify job");
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <Button variant="secondary" onClick={onPush} loading={pending} loadingText="Queueing..." disabled={disabled}>
        Push to Shopify
      </Button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
