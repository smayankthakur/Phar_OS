"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";

type PricingSettings = {
  minMarginPercent: number;
  maxPriceChangePercent: number;
  roundingMode: "NONE" | "NEAREST_1" | "NEAREST_5" | "NEAREST_10";
};

export function PricingSettingsForm({ initial }: { initial: PricingSettings }) {
  const [values, setValues] = useState<PricingSettings>(initial);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "error" } | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setToast(null);

    try {
      const response = await fetch("/api/settings/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to save settings");
      }
      setValues(body.item);
      setToast({ message: "Pricing guardrails saved", tone: "ok" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Failed to save settings", tone: "error" });
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="sku-form" onSubmit={onSubmit}>
      <label className="field">
        <span>Minimum Margin %</span>
        <input
          type="number"
          min={0}
          max={90}
          step="0.01"
          value={values.minMarginPercent}
          onChange={(event) => setValues((prev) => ({ ...prev, minMarginPercent: Number(event.target.value) }))}
          required
        />
      </label>

      <label className="field">
        <span>Max Price Change %</span>
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={values.maxPriceChangePercent}
          onChange={(event) => setValues((prev) => ({ ...prev, maxPriceChangePercent: Number(event.target.value) }))}
          required
        />
      </label>

      <label className="field">
        <span>Rounding Mode</span>
        <select
          value={values.roundingMode}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, roundingMode: event.target.value as PricingSettings["roundingMode"] }))
          }
        >
          <option value="NONE">NONE</option>
          <option value="NEAREST_1">NEAREST_1</option>
          <option value="NEAREST_5">NEAREST_5</option>
          <option value="NEAREST_10">NEAREST_10</option>
        </select>
      </label>

      <div className="content-card">
        <p className="metric-note">Example: with 10% min margin and cost 100, minimum safe price is 111.11.</p>
        <p className="metric-note">Max change 15% means recommendation stays within +/-15% of current price.</p>
      </div>

      <Button type="submit" loading={pending} loadingText="Saving...">
        Save Guardrails
      </Button>

      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </form>
  );
}
