"use client";

import { calcDeltaPercent, round2 } from "@pharos/core";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { SnapshotCsvImport } from "@/components/sku/SnapshotCsvImport";
import { formatMoney, formatTs } from "@/lib/format";

type CompetitorOption = {
  id: string;
  name: string;
  currency: string;
};

type LatestRow = {
  competitorId: string;
  competitorName: string;
  currency: string;
  price: number;
  capturedAt: string;
};

export function SkuCompetitorPanel({
  skuId,
  ourPrice,
  competitors,
  latestRows,
}: {
  skuId: string;
  ourPrice: number;
  competitors: CompetitorOption[];
  latestRows: LatestRow[];
}) {
  const router = useRouter();
  const [competitorId, setCompetitorId] = useState(competitors[0]?.id ?? "");
  const [price, setPrice] = useState<number>(ourPrice);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/skus/${skuId}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorId, price }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed to add snapshot");
      }

      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to add snapshot");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="content-card">
      <h3>Competitor Prices</h3>
      <table className="sku-table">
        <thead>
          <tr>
            <th>Competitor</th>
            <th>Their Price</th>
            <th>Captured</th>
            <th>Delta vs Our Price</th>
          </tr>
        </thead>
        <tbody>
          {latestRows.map((row) => {
            const deltaValue = round2(row.price - ourPrice);
            const deltaPercent = calcDeltaPercent(ourPrice, row.price);
            const sign = deltaValue >= 0 ? "+" : "";
            return (
              <tr key={row.competitorId}>
                <td>{row.competitorName}</td>
                <td>
                  {formatMoney(row.price, row.currency)}
                </td>
                <td title={formatTs(row.capturedAt).title}>{formatTs(row.capturedAt).label}</td>
                <td>
                  {sign}
                  {formatMoney(Math.abs(deltaValue))} ({sign}
                  {deltaPercent.toFixed(2)}%)
                </td>
              </tr>
            );
          })}
          {latestRows.length === 0 ? (
            <tr>
              <td colSpan={4}>No snapshots yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <form className="sku-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Competitor</span>
          <select value={competitorId} onChange={(event) => setCompetitorId(event.target.value)} required>
            {competitors.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Price</span>
          <input type="number" min={0.01} step="0.01" value={price} onChange={(event) => setPrice(Number(event.target.value))} required />
        </label>

        {error ? <p className="form-error">{error}</p> : null}
        <button className="button-primary" type="submit" disabled={pending || competitors.length === 0}>
          {pending ? "Saving..." : "Add Snapshot"}
        </button>
      </form>

      <SnapshotCsvImport skuId={skuId} />
    </section>
  );
}
