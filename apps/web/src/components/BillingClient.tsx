"use client";

import { useEffect, useMemo, useState } from "react";
import { Toast } from "@/components/ui/Toast";
import { PLAN_TIERS, type PlanTier } from "@/lib/plans";

type BillingPayload = {
  workspace: { id: string; name: string };
  subscription: {
    plan: PlanTier;
    status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  limits: {
    seatLimit: number;
    skuLimit: number;
    competitorLimit: number;
    monthlySnapshotImportLimit: number;
  };
  usage: {
    yearMonth: string;
    seatsUsed: number;
    skusUsed: number;
    competitorsUsed: number;
    snapshotImportRowsUsed: number;
    portalTokensUsed: number;
  };
  features: Record<string, boolean>;
};

function pct(used: number, limit: number) {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const value = pct(used, limit);
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">
        {used} / {limit}
      </p>
      <div style={{ height: 8, background: "#1d2a4a", borderRadius: 999 }}>
        <div style={{ height: 8, width: `${value}%`, background: value > 90 ? "#c05656" : "#4b74be", borderRadius: 999 }} />
      </div>
    </div>
  );
}

export function BillingClient({ ownerMode }: { ownerMode: boolean }) {
  const [data, setData] = useState<BillingPayload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [planDraft, setPlanDraft] = useState<PlanTier>("STARTER");
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [portalPending, setPortalPending] = useState(false);
  const manualPlanEnabled = process.env.NEXT_PUBLIC_ALLOW_MANUAL_PLAN_CHANGE === "1";

  const load = async () => {
    setError(null);
    const response = await fetch("/api/billing", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) {
      setError(body?.error?.message ?? "Failed to load billing");
      return;
    }
    setData(body as BillingPayload);
    setPlanDraft(body.subscription.plan);
  };

  useEffect(() => {
    void load();
  }, []);

  const onChangePlan = async () => {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planDraft }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        setError(body?.error?.message ?? "Failed to change plan");
        return;
      }
      setMessage(`Plan changed to ${planDraft}`);
      await load();
    } finally {
      setPending(false);
    }
  };

  const onUpgrade = async (plan: PlanTier) => {
    setCheckoutPending(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok || !body.url) {
        setError(body?.error?.message ?? "Failed to start checkout");
        return;
      }
      window.location.href = body.url;
    } finally {
      setCheckoutPending(false);
    }
  };

  const onManageBilling = async () => {
    setPortalPending(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok || !body.url) {
        setError(body?.error?.message ?? "Failed to open billing portal");
        return;
      }
      window.location.href = body.url;
    } finally {
      setPortalPending(false);
    }
  };

  const features = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.features);
  }, [data]);

  return (
    <div className="detail-grid">
      {error ? <Toast message={error} tone="error" /> : null}
      {message ? <Toast message={message} tone="ok" /> : null}

      <section className="content-card">
        <h2>Workspace Plan</h2>
        <p>
          Current plan: <strong>{data?.subscription.plan ?? "-"}</strong>
        </p>
        <p>
          Billing status:{" "}
          <span className={data?.subscription.status === "ACTIVE" || data?.subscription.status === "TRIALING" ? "ui-badge-ok" : "ui-badge-breach"}>
            {data?.subscription.status ?? "-"}
          </span>
        </p>
        {data?.subscription.currentPeriodEnd ? (
          <p className="metric-note">Current period ends: {new Date(data.subscription.currentPeriodEnd).toLocaleString()}</p>
        ) : null}
        {data?.subscription.status === "PAST_DUE" || data?.subscription.status === "CANCELED" ? (
          <p className="form-error">Billing issue detected. Premium write actions are temporarily blocked.</p>
        ) : null}
        {ownerMode ? (
          <div className="row-actions">
            <button className="button-primary" type="button" onClick={() => onUpgrade("PRO")} disabled={checkoutPending}>
              {checkoutPending ? "Redirecting..." : "Upgrade to PRO"}
            </button>
            <button className="button-secondary" type="button" onClick={() => onUpgrade("AGENCY")} disabled={checkoutPending}>
              {checkoutPending ? "Redirecting..." : "Upgrade to AGENCY"}
            </button>
            <button className="button-secondary" type="button" onClick={onManageBilling} disabled={portalPending}>
              {portalPending ? "Opening..." : "Manage Billing"}
            </button>
          </div>
        ) : (
          <p className="metric-note">Only OWNER can change plan.</p>
        )}
        {ownerMode && manualPlanEnabled ? (
          <div className="row-actions">
            <select value={planDraft} onChange={(e) => setPlanDraft(e.target.value as PlanTier)}>
              {PLAN_TIERS.map((plan) => (
                <option key={plan} value={plan}>{plan}</option>
              ))}
            </select>
            <button className="button-ghost" type="button" onClick={onChangePlan} disabled={pending || !data}>
              {pending ? "Saving..." : "Manual plan change (DEV)"}
            </button>
          </div>
        ) : null}
        <p>
          <a className="button-secondary" href="mailto:sales@pharos.local?subject=PharOS%20Upgrade%20Request">
            Request Upgrade
          </a>
        </p>
      </section>

      {data ? (
        <section className="content-card">
          <h2>Usage ({data.usage.yearMonth})</h2>
          <div className="metric-grid">
            <Meter label="Seats" used={data.usage.seatsUsed} limit={data.limits.seatLimit} />
            <Meter label="SKUs" used={data.usage.skusUsed} limit={data.limits.skuLimit} />
            <Meter label="Competitors" used={data.usage.competitorsUsed} limit={data.limits.competitorLimit} />
            <Meter
              label="Import Rows"
              used={data.usage.snapshotImportRowsUsed}
              limit={data.limits.monthlySnapshotImportLimit}
            />
          </div>
        </section>
      ) : null}

      <section className="content-card">
        <h2>Features</h2>
        <div className="signals-list">
          {features.map(([name, enabled]) => (
            <article key={name} className="signal-card">
              <div className="signal-top">
                <strong>{name}</strong>
                <span className={enabled ? "ui-badge-ok" : "ui-badge-breach"}>{enabled ? "Enabled" : "Locked"}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
