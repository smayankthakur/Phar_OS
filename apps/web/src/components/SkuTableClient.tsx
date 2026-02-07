"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LoadDemoDatasetButton } from "@/components/LoadDemoDatasetButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/format";

type SkuRow = {
  id: string;
  title: string;
  sku: string;
  cost: number;
  currentPrice: number;
  marginPercent: number;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
};

export function SkuTableClient({ items }: { items: SkuRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.title.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <section className="content-card">
      <div className="list-toolbar">
        <input
          className="search-input"
          placeholder="Search by title or SKU"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <table className="sku-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Title</th>
            <th>Cost</th>
            <th>Price</th>
            <th>Margin %</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((item) => (
            <tr key={item.id}>
              <td>
                <Link href={`/skus/${item.id}`}>{item.sku}</Link>
              </td>
              <td>{item.title}</td>
              <td>{formatMoney(item.cost)}</td>
              <td>{formatMoney(item.currentPrice)}</td>
              <td>{item.marginPercent.toFixed(2)}%</td>
              <td>{item.status}</td>
            </tr>
          ))}
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <EmptyState
                  title="No SKUs found"
                  description={items.length === 0 ? "Create your first SKU or load the demo dataset." : "No SKUs match this search."}
                  action={
                    <>
                      {items.length === 0 ? <LoadDemoDatasetButton /> : null}
                      <Link href="/skus/new" className="button-primary">
                        Add SKU
                      </Link>
                    </>
                  }
                />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
