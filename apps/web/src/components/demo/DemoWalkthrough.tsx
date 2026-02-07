"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Toast } from "@/components/ui/Toast";
import { withCsrfHeaders } from "@/lib/csrf-client";

type SimulationType = "COMPETITOR_PRICE_DROP" | "COST_INCREASE" | "STOCK_LOW";

type RecommendedAction = {
  id: string;
  type: string;
  status: string;
  safetyStatus: "OK" | "BLOCKED";
  safetyReason: string | null;
  title: string;
  skuId: string | null;
  sku: {
    id: string;
    sku: string;
    title: string;
  } | null;
};

type Counts = {
  skusCount: number;
  competitorsCount: number;
  snapshotsCount: number;
  rulesCount: number;
  eventsCount: number;
  actionsRecommendedCount: number;
  actionsAppliedCount: number;
  auditsCount: number;
  blockedActionsCount: number;
};

const SIMULATIONS: Array<{ type: SimulationType; label: string }> = [
  { type: "COMPETITOR_PRICE_DROP", label: "Competitor Price Drop" },
  { type: "COST_INCREASE", label: "Cost Increase" },
  { type: "STOCK_LOW", label: "Stock Low" },
];

export function DemoWalkthrough() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [recommended, setRecommended] = useState<RecommendedAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const [simulatePending, setSimulatePending] = useState<SimulationType | null>(null);
  const [applyPendingId, setApplyPendingId] = useState<string | null>(null);
  const [lastAppliedSkuId, setLastAppliedSkuId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dbCheckRes, actionsRes] = await Promise.all([
        fetch("/api/db-check", { cache: "no-store" }),
        fetch("/api/actions?status=RECOMMENDED&limit=5", { cache: "no-store" }),
      ]);

      if (!dbCheckRes.ok) throw new Error("Failed to load counts");
      if (!actionsRes.ok) throw new Error("Failed to load recommendations");

      const dbCheck = await dbCheckRes.json();
      const actions = await actionsRes.json();

      setCounts({
        skusCount: dbCheck.skusCount ?? 0,
        competitorsCount: dbCheck.competitorsCount ?? 0,
        snapshotsCount: dbCheck.snapshotsCount ?? 0,
        rulesCount: dbCheck.rulesCount ?? 0,
        eventsCount: dbCheck.eventsCount ?? 0,
        actionsRecommendedCount: dbCheck.actionsRecommendedCount ?? 0,
        actionsAppliedCount: dbCheck.actionsAppliedCount ?? 0,
        auditsCount: dbCheck.auditsCount ?? 0,
        blockedActionsCount: dbCheck.blockedActionsCount ?? 0,
      });
      setRecommended((actions.items ?? []) as RecommendedAction[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load demo data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onReset = async () => {
    setResetPending(true);
    setError(null);
    setBanner(null);
    try {
      const response = await fetch("/api/demo/reset", { method: "POST", headers: withCsrfHeaders() });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Reset failed");
      }
      setBanner("Demo dataset loaded");
      setLastAppliedSkuId(null);
      await loadData();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Reset failed");
    } finally {
      setResetPending(false);
    }
  };

  const onSimulate = async (type: SimulationType) => {
    setSimulatePending(type);
    setError(null);
    try {
      const response = await fetch("/api/demo/simulate", {
        method: "POST",
        headers: withCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ type }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Simulation failed");
      }
      await loadData();
    } catch (simulateError) {
      setError(simulateError instanceof Error ? simulateError.message : "Simulation failed");
    } finally {
      setSimulatePending(null);
    }
  };

  const onApply = async (actionId: string) => {
    setApplyPendingId(actionId);
    setError(null);
    try {
      const response = await fetch(`/api/actions/${actionId}/apply`, { method: "POST", headers: withCsrfHeaders() });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Apply failed");
      }
      setLastAppliedSkuId(body.sku?.id ?? null);
      await loadData();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Apply failed");
    } finally {
      setApplyPendingId(null);
    }
  };

  const applyTopRecommendation = async () => {
    const firstApplicable = recommended.find((item) => item.safetyStatus !== "BLOCKED");
    if (!firstApplicable) {
      setError("No applicable recommendation available");
      return;
    }
    await onApply(firstApplicable.id);
  };

  return (
    <div className="detail-grid">
      <section className="content-card">
        <h2>Demo Walkthrough</h2>
        <p>Run the full loop in one place: reset, simulate, review, apply, and inspect timeline.</p>
        <div className="row-actions">
          <a className="button-secondary" href="/api/demo/export">
            Export dataset
          </a>
        </div>
      </section>

      {banner ? <Toast message={banner} tone="ok" /> : null}
      {error ? <Toast message={error} tone="error" /> : null}

      <section className="content-card">
        <h3>Demo Script</h3>
        <ol>
          <li>
            Reset dataset
            <div className="row-actions">
              <button type="button" className="button-secondary" onClick={onReset} disabled={resetPending}>
                {resetPending ? "Resetting..." : "Reset Dataset"}
              </button>
            </div>
          </li>
          <li>
            Run competitor drop signal
            <div className="row-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => onSimulate("COMPETITOR_PRICE_DROP")}
                disabled={simulatePending !== null}
              >
                {simulatePending === "COMPETITOR_PRICE_DROP" ? "Running..." : "Run Competitor Drop"}
              </button>
            </div>
          </li>
          <li>
            Open Command Center recommendations
            <div className="row-actions">
              <Link className="button-secondary" href="/">
                Open Command Center
              </Link>
            </div>
          </li>
          <li>
            Apply top recommendation
            <div className="row-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={applyTopRecommendation}
                disabled={applyPendingId !== null || recommended.length === 0}
              >
                {applyPendingId ? "Applying..." : "Apply Top Recommendation"}
              </button>
            </div>
          </li>
          <li>
            Open SKU Timeline and Audit
            <div className="row-actions">
              {lastAppliedSkuId ? (
                <Link className="button-secondary" href={`/skus/${lastAppliedSkuId}?tab=timeline`}>
                  Open SKU Timeline
                </Link>
              ) : (
                <span className="badge">Apply a recommendation first</span>
              )}
            </div>
          </li>
        </ol>
      </section>

      <section className="content-card">
        <h3>Step A: Reset Dataset</h3>
        <button type="button" className="button-primary" onClick={onReset} disabled={resetPending}>
          {resetPending ? "Resetting..." : "Reset Dataset"}
        </button>
      </section>

      <section className="content-card">
        <h3>Step B: Run Simulation</h3>
        <div className="row-actions">
          {SIMULATIONS.map((item) => (
            <button
              key={item.type}
              type="button"
              className="button-secondary"
              onClick={() => onSimulate(item.type)}
              disabled={simulatePending !== null}
            >
              {simulatePending === item.type ? "Running..." : item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="content-card">
        <h3>Step C: Review Recommendations</h3>
        <p><Link href="/">View in Command Center</Link></p>
      </section>

      <section className="content-card">
        <h3>Step D: Apply Recommendation</h3>
        <div className="signals-list">
          {recommended.map((action) => (
            <article key={action.id} className="signal-card">
              <div className="signal-top">
                <span className="signal-badge">{action.type}</span>
                <span className="signal-time">{action.safetyStatus}</span>
              </div>
              <p className="signal-sku">
                SKU: {action.sku?.title ?? "N/A"} ({action.sku?.sku ?? "-"})
              </p>
              <p className="signal-summary">{action.title}</p>
              {action.safetyStatus === "BLOCKED" ? <p className="form-error">{action.safetyReason ?? "Blocked by guardrails"}</p> : null}
              <div className="row-actions">
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => onApply(action.id)}
                  disabled={applyPendingId !== null || action.safetyStatus === "BLOCKED"}
                >
                  {applyPendingId === action.id ? "Applying..." : action.safetyStatus === "BLOCKED" ? "Blocked" : "Apply"}
                </button>
                {action.skuId ? (
                  <Link className="button-secondary" href={`/skus/${action.skuId}?tab=timeline`}>
                    View SKU Timeline
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
          {!loading && recommended.length === 0 ? <p>No recommendations yet. Run a simulation.</p> : null}
        </div>
      </section>

      <section className="content-card">
        <h3>Step E: View Audit + Timeline</h3>
        <div className="row-actions">
          <Link className="button-secondary" href="/">View in Command Center</Link>
          {lastAppliedSkuId ? (
            <Link className="button-secondary" href={`/skus/${lastAppliedSkuId}?tab=timeline`}>
              View SKU Timeline
            </Link>
          ) : (
            <span className="badge">Apply a recommendation to unlock timeline deep link</span>
          )}
        </div>
      </section>

      <section className="content-card">
        <h3>Workspace Demo Counts</h3>
        {loading ? <p>Loading counts...</p> : null}
        {counts ? (
          <div className="metric-grid">
            <article className="metric-card"><p className="metric-label">SKUs</p><p className="metric-value">{counts.skusCount}</p></article>
            <article className="metric-card"><p className="metric-label">Competitors</p><p className="metric-value">{counts.competitorsCount}</p></article>
            <article className="metric-card"><p className="metric-label">Snapshots</p><p className="metric-value">{counts.snapshotsCount}</p></article>
            <article className="metric-card"><p className="metric-label">Rules</p><p className="metric-value">{counts.rulesCount}</p></article>
            <article className="metric-card"><p className="metric-label">Events</p><p className="metric-value">{counts.eventsCount}</p></article>
            <article className="metric-card"><p className="metric-label">Recommended</p><p className="metric-value">{counts.actionsRecommendedCount}</p></article>
            <article className="metric-card"><p className="metric-label">Applied</p><p className="metric-value">{counts.actionsAppliedCount}</p></article>
            <article className="metric-card"><p className="metric-label">Blocked</p><p className="metric-value">{counts.blockedActionsCount}</p></article>
            <article className="metric-card"><p className="metric-label">Audits</p><p className="metric-value">{counts.auditsCount}</p></article>
          </div>
        ) : null}
      </section>
    </div>
  );
}
