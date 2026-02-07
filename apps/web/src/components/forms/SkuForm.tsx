"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type SKUStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

type SkuFormValues = {
  title: string;
  sku: string;
  cost: number;
  currentPrice: number;
  status: SKUStatus;
};

type SkuFormProps = {
  mode: "create" | "edit";
  skuId?: string;
  initialValues: SkuFormValues;
  fields?: Array<"title" | "sku" | "cost" | "currentPrice" | "status">;
  submitLabel: string;
  successHref?: string;
};

const DEFAULT_FIELDS: Array<"title" | "sku" | "cost" | "currentPrice" | "status"> = [
  "title",
  "sku",
  "cost",
  "currentPrice",
  "status",
];

export function SkuForm({ mode, skuId, initialValues, fields = DEFAULT_FIELDS, submitLabel, successHref }: SkuFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const updateField = <K extends keyof SkuFormValues>(key: K, value: SkuFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const endpoint = mode === "create" ? "/api/skus" : `/api/skus/${skuId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const payload =
      mode === "create"
        ? values
        : {
            ...(fields.includes("title") ? { title: values.title } : {}),
            ...(fields.includes("sku") ? { sku: values.sku } : {}),
            ...(fields.includes("cost") ? { cost: values.cost } : {}),
            ...(fields.includes("currentPrice") ? { currentPrice: values.currentPrice } : {}),
            ...(fields.includes("status") ? { status: values.status } : {}),
          };

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Request failed");
      }

      if (successHref) {
        router.push(successHref);
      } else {
        router.refresh();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Request failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="sku-form" onSubmit={onSubmit}>
      {fields.includes("title") ? (
        <label className="field">
          <span>Title</span>
          <input value={values.title} onChange={(event) => updateField("title", event.target.value)} minLength={2} required />
        </label>
      ) : null}

      {fields.includes("sku") ? (
        <label className="field">
          <span>SKU Code</span>
          <input value={values.sku} onChange={(event) => updateField("sku", event.target.value)} minLength={2} required />
        </label>
      ) : null}

      {fields.includes("cost") ? (
        <label className="field">
          <span>Cost</span>
          <input
            type="number"
            min={0.01}
            step="0.01"
            value={values.cost}
            onChange={(event) => updateField("cost", Number(event.target.value))}
            required
          />
        </label>
      ) : null}

      {fields.includes("currentPrice") ? (
        <label className="field">
          <span>Current Price</span>
          <input
            type="number"
            min={0.01}
            step="0.01"
            value={values.currentPrice}
            onChange={(event) => updateField("currentPrice", Number(event.target.value))}
            required
          />
        </label>
      ) : null}

      {fields.includes("status") ? (
        <label className="field">
          <span>Status</span>
          <select value={values.status} onChange={(event) => updateField("status", event.target.value as SKUStatus)}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PAUSED">PAUSED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </label>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <button type="submit" className="button-primary" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
