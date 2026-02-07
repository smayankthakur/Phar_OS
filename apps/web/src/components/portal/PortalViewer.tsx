"use client";

import { useEffect, useState } from "react";
import { formatMoney, formatTs } from "@/lib/format";
import type { Branding } from "@/lib/branding";

type PortalSummary = {
  workspace: { name: string };
  settings: {
    minMarginPercent: number;
    maxPriceChangePercent: number;
    roundingMode: string;
  };
  counts: {
    skus: number;
    competitors: number;
    signals7d: number;
    recommendedOpen: number;
    applied7d: number;
  };
};

type PortalSignal = {
  type: string;
  summary: string;
  createdAt: string;
  sku: { sku: string; title: string } | null;
};

type PortalAction = {
  type: string;
  title: string;
  safetyStatus: string;
  safetyReason: string | null;
  createdAt: string;
  appliedAt: string | null;
  sku: { sku: string; title: string } | null;
  ruleName: string | null;
};

type PortalMarginItem = {
  sku: string;
  title: string;
  cost: number;
  currentPrice: number;
  marginPercent: number;
  belowMin: boolean;
};

type PortalTab = "summary" | "signals" | "recommended" | "applied" | "margin";

export function PortalViewer({
  token,
  initialWorkspaceName,
  branding,
}: {
  token: string;
  initialWorkspaceName: string;
  branding: Branding;
}) {
  const [tab, setTab] = useState<PortalTab>("summary");
  const [summary, setSummary] = useState<PortalSummary | null>(null);
  const [signals, setSignals] = useState<PortalSignal[]>([]);
  const [recommended, setRecommended] = useState<PortalAction[]>([]);
  const [applied, setApplied] = useState<PortalAction[]>([]);
  const [marginData, setMarginData] = useState<{ minMarginPercent: number; items: PortalMarginItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [summaryRes, signalsRes, recommendedRes, appliedRes, marginRes] = await Promise.all([
          fetch(`/api/portal/${token}/summary`, { cache: "no-store" }),
          fetch(`/api/portal/${token}/signals`, { cache: "no-store" }),
          fetch(`/api/portal/${token}/actions?status=RECOMMENDED`, { cache: "no-store" }),
          fetch(`/api/portal/${token}/actions?status=APPLIED`, { cache: "no-store" }),
          fetch(`/api/portal/${token}/margin`, { cache: "no-store" }),
        ]);

        const responses = [summaryRes, signalsRes, recommendedRes, appliedRes, marginRes];
        for (const response of responses) {
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body?.error?.message ?? "Failed to load portal data");
          }
        }

        const [summaryBody, signalsBody, recommendedBody, appliedBody, marginBody] = await Promise.all(
          responses.map((response) => response.json()),
        );

        if (cancelled) return;

        setSummary(summaryBody as PortalSummary);
        setSignals((signalsBody.items ?? []) as PortalSignal[]);
        setRecommended((recommendedBody.items ?? []) as PortalAction[]);
        setApplied((appliedBody.items ?? []) as PortalAction[]);
        setMarginData({
          minMarginPercent: Number(marginBody.minMarginPercent ?? 0),
          items: (marginBody.items ?? []) as PortalMarginItem[],
        });
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : "Failed to load portal data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const lastUpdated = formatTs(new Date()).title;
  const appName = branding.appName || "Client Portal";

  return (
    <div
      className="portal-root"
      style={branding.accentColor ? ({ ["--accent" as string]: branding.accentColor } as React.CSSProperties) : undefined}
    >
      <header className="portal-header content-card">
        <div className="logo" style={{ marginBottom: "0.35rem" }}>
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={appName} width={28} height={28} className="logo-mark" />
          ) : null}
          <span>{appName}</span>
        </div>
        <h1>Client Portal</h1>
        <p>Workspace: {summary?.workspace.name ?? initialWorkspaceName}</p>
        <p className="metric-note">Read-only reporting view. Last updated: {lastUpdated}</p>
      </header>

      {error ? <section className="content-card"><p className="form-error">{error}</p></section> : null}
      {loading ? <section className="content-card"><p>Loading portal data...</p></section> : null}

      <section className="content-card">
        <div className="row-actions">
          <button className={tab === "summary" ? "button-primary" : "button-secondary"} onClick={() => setTab("summary")}>Summary</button>
          <button className={tab === "signals" ? "button-primary" : "button-secondary"} onClick={() => setTab("signals")}>Signals</button>
          <button className={tab === "recommended" ? "button-primary" : "button-secondary"} onClick={() => setTab("recommended")}>Recommendations</button>
          <button className={tab === "applied" ? "button-primary" : "button-secondary"} onClick={() => setTab("applied")}>Applied</button>
          <button className={tab === "margin" ? "button-primary" : "button-secondary"} onClick={() => setTab("margin")}>Margin Safety</button>
        </div>
      </section>

      {tab === "summary" && summary ? (
        <section className="content-card">
          <h3>Executive Summary</h3>
          <div className="metric-grid">
            <article className="metric-card"><p className="metric-label">SKUs</p><p className="metric-value">{summary.counts.skus}</p></article>
            <article className="metric-card"><p className="metric-label">Competitors</p><p className="metric-value">{summary.counts.competitors}</p></article>
            <article className="metric-card"><p className="metric-label">Signals (7d)</p><p className="metric-value">{summary.counts.signals7d}</p></article>
            <article className="metric-card"><p className="metric-label">Recommended Open</p><p className="metric-value">{summary.counts.recommendedOpen}</p></article>
            <article className="metric-card"><p className="metric-label">Applied (7d)</p><p className="metric-value">{summary.counts.applied7d}</p></article>
          </div>
          <p className="metric-note">
            Guardrails: min margin {summary.settings.minMarginPercent}% | max change {summary.settings.maxPriceChangePercent}% | rounding {summary.settings.roundingMode}
          </p>
        </section>
      ) : null}

      {tab === "signals" ? (
        <section className="content-card">
          <h3>Signals (latest 25)</h3>
          <div className="signals-list">
            {signals.map((item, index) => (
              <article className="signal-card" key={`${item.type}-${item.createdAt}-${index}`}>
                <div className="signal-top">
                  <span className="signal-badge">{item.type}</span>
                  <span className="signal-time" title={formatTs(item.createdAt).title}>{formatTs(item.createdAt).label}</span>
                </div>
                <p className="signal-sku">SKU: {item.sku ? `${item.sku.title} (${item.sku.sku})` : "-"}</p>
                <p className="signal-summary">{item.summary}</p>
              </article>
            ))}
            {signals.length === 0 ? <p>No signals available.</p> : null}
          </div>
        </section>
      ) : null}

      {tab === "recommended" ? (
        <section className="content-card">
          <h3>Recommendations (latest 25)</h3>
          <div className="signals-list">
            {recommended.map((item, index) => (
              <article className="signal-card" key={`${item.type}-${item.createdAt}-${index}`}>
                <div className="signal-top">
                  <span className="signal-badge">{item.type}</span>
                  <span className="signal-time" title={formatTs(item.createdAt).title}>{formatTs(item.createdAt).label}</span>
                </div>
                <p className="signal-sku">SKU: {item.sku ? `${item.sku.title} (${item.sku.sku})` : "-"}</p>
                <p className="signal-summary">{item.title}</p>
                <p className="signal-summary">Rule: {item.ruleName ?? "-"}</p>
                {item.safetyStatus === "BLOCKED" ? <p className="form-error">Blocked: {item.safetyReason ?? "Guardrail blocked"}</p> : null}
              </article>
            ))}
            {recommended.length === 0 ? <p>No recommendations available.</p> : null}
          </div>
        </section>
      ) : null}

      {tab === "applied" ? (
        <section className="content-card">
          <h3>Applied Actions (latest 25)</h3>
          <div className="signals-list">
            {applied.map((item, index) => (
              <article className="signal-card" key={`${item.type}-${item.appliedAt ?? item.createdAt}-${index}`}>
                <div className="signal-top">
                  <span className="signal-badge">{item.type}</span>
                  <span className="signal-time" title={formatTs(item.appliedAt ?? item.createdAt).title}>{formatTs(item.appliedAt ?? item.createdAt).label}</span>
                </div>
                <p className="signal-sku">SKU: {item.sku ? `${item.sku.title} (${item.sku.sku})` : "-"}</p>
                <p className="signal-summary">{item.title}</p>
              </article>
            ))}
            {applied.length === 0 ? <p>No applied actions available.</p> : null}
          </div>
        </section>
      ) : null}

      {tab === "margin" && marginData ? (
        <section className="content-card">
          <h3>Margin Safety</h3>
          <p className="metric-note">Guardrail minimum margin: {marginData.minMarginPercent}%</p>
          <table className="sku-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Title</th>
                <th>Cost</th>
                <th>Current Price</th>
                <th>Margin %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {marginData.items.map((item) => (
                <tr key={item.sku}>
                  <td>{item.sku}</td>
                  <td>{item.title}</td>
                  <td>{formatMoney(item.cost)}</td>
                  <td>{formatMoney(item.currentPrice)}</td>
                  <td>{item.marginPercent.toFixed(2)}%</td>
                  <td>{item.belowMin ? "Below minimum" : "Within guardrail"}</td>
                </tr>
              ))}
              {marginData.items.length === 0 ? (
                <tr>
                  <td colSpan={6}>No SKU data available.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
