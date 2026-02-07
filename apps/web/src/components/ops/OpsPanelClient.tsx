"use client";

import { useState } from "react";
import { withCsrfHeaders } from "@/lib/csrf-client";

async function postJson(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: withCsrfHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, payload };
}

export function OpsPanelClient({
  shopify,
  notifications,
}: {
  shopify: Record<string, number>;
  notifications: Record<string, number>;
}) {
  const [pending, setPending] = useState<null | "shopify" | "notifications">(null);
  const [message, setMessage] = useState<string | null>(null);

  const runShopify = async () => {
    setMessage(null);
    setPending("shopify");
    try {
      const result = await postJson("/api/ops/process-shopify", { limit: 10 });
      if (!result.ok || !result.payload?.ok) {
        setMessage(result.payload?.error?.message ?? "Failed to process Shopify jobs");
        return;
      }
      setMessage(`Processed ${result.payload.processed?.length ?? 0} Shopify jobs`);
      window.location.reload();
    } finally {
      setPending(null);
    }
  };

  const runNotifications = async () => {
    setMessage(null);
    setPending("notifications");
    try {
      const result = await postJson("/api/ops/process-notifications", { limit: 10 });
      if (!result.ok || !result.payload?.ok) {
        setMessage(result.payload?.error?.message ?? "Failed to process notifications");
        return;
      }
      setMessage(`Processed ${result.payload.processed?.length ?? 0} notifications`);
      window.location.reload();
    } finally {
      setPending(null);
    }
  };

  const row = (label: string, counts: Record<string, number>) => (
    <div className="metric-row">
      <div className="metric-label">{label}</div>
      <div className="metric-values">
        <span>QUEUED: {counts.QUEUED ?? 0}</span>
        <span>RUNNING: {counts.RUNNING ?? 0}</span>
        <span>SUCCEEDED/SENT: {counts.SUCCEEDED ?? counts.SENT ?? 0}</span>
        <span>FAILED: {counts.FAILED ?? 0}</span>
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
      {row("Shopify Jobs", shopify)}
      <button className="button-primary" onClick={runShopify} disabled={pending !== null}>
        {pending === "shopify" ? "Processing..." : "Process Shopify Now"}
      </button>

      {row("Notification Outbox", notifications)}
      <button className="button-primary" onClick={runNotifications} disabled={pending !== null}>
        {pending === "notifications" ? "Processing..." : "Process Notifications Now"}
      </button>

      {message ? <p className="form-error">{message}</p> : null}
    </div>
  );
}
