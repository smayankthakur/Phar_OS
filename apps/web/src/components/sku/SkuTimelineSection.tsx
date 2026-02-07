"use client";

import { useEffect, useMemo, useState } from "react";
import { AuditModal } from "@/components/audit/AuditModal";

type TimelineKindFilter = "ALL" | "EVENT" | "ACTION" | "AUDIT";

type TimelineItem =
  | {
      kind: "EVENT";
      id: string;
      ts: string;
      subtype: string;
      summary: string;
      data: {
        payload: unknown;
      };
    }
  | {
      kind: "ACTION";
      id: string;
      ts: string;
      subtype: string;
      status: string;
      title: string;
      summary: string;
      ruleName?: string;
      data: {
        details: unknown;
      };
    }
  | {
      kind: "AUDIT";
      id: string;
      ts: string;
      subtype: string;
      summary: string;
      data: {
        hasBefore: boolean;
        hasAfter: boolean;
      };
    };

type TimelineResponse = {
  ok: true;
  sku: {
    id: string;
    sku: string;
    title: string;
  };
  items: TimelineItem[];
};

const FILTERS: Array<{ key: TimelineKindFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "EVENT", label: "Events" },
  { key: "ACTION", label: "Actions" },
  { key: "AUDIT", label: "Audits" },
];

export function SkuTimelineSection({ skuId }: { skuId: string }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TimelineKindFilter>("ALL");
  const [openAuditId, setOpenAuditId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTimeline() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/skus/${skuId}/timeline`);
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? "Failed to load timeline");
        }

        const body: TimelineResponse = await response.json();
        if (active) setItems(body.items);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Failed to load timeline");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTimeline();
    return () => {
      active = false;
    };
  }, [skuId]);

  const filteredItems = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((item) => item.kind === filter);
  }, [items, filter]);

  return (
    <section className="content-card">
      <h3>Timeline</h3>

      <div className="row-actions">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={filter === entry.key ? "button-primary" : "button-secondary"}
            onClick={() => setFilter(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {loading ? <p>Loading timeline...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="signals-list">
        {filteredItems.map((item) => (
          <article key={`${item.kind}-${item.id}`} className="signal-card">
            <div className="signal-top">
              <span className="signal-badge">
                {item.kind} / {item.subtype}
              </span>
              <span className="signal-time">{new Date(item.ts).toLocaleString()}</span>
            </div>
            <p className="signal-summary">{item.summary}</p>
            {item.kind === "ACTION" ? <p className="signal-sku">Status: {item.status}</p> : null}
            {item.kind === "AUDIT" ? (
              <div className="row-actions">
                <button type="button" className="button-secondary" onClick={() => setOpenAuditId(item.id)}>
                  View Audit
                </button>
              </div>
            ) : null}
          </article>
        ))}
        {!loading && filteredItems.length === 0 ? <p>No timeline entries.</p> : null}
      </div>

      {openAuditId ? <AuditModal auditId={openAuditId} onClose={() => setOpenAuditId(null)} /> : null}
    </section>
  );
}
