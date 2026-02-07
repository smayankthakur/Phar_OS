"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { withCsrfHeaders } from "@/lib/csrf-client";

type SettingsItem = {
  id: string;
  workspaceId: string;
  shopDomain: string | null;
  adminAccessTokenMasked: string | null;
  priceUpdateMode: "DRY_RUN" | "LIVE";
  configured: boolean;
  createdAt: string;
  updatedAt: string;
};

export function ShopifyIntegrationPanel() {
  const [settings, setSettings] = useState<SettingsItem | null>(null);
  const [shopDomain, setShopDomain] = useState("");
  const [adminAccessToken, setAdminAccessToken] = useState("");
  const [priceUpdateMode, setPriceUpdateMode] = useState<"DRY_RUN" | "LIVE">("DRY_RUN");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastProcessResult, setLastProcessResult] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "ok" | "error"; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/integrations/shopify", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to load Shopify settings");
      }
      const item = body.item as SettingsItem;
      setSettings(item);
      setShopDomain(item.shopDomain ?? "");
      setPriceUpdateMode(item.priceUpdateMode);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSave = async () => {
    setSaving(true);
    setToast(null);
    try {
      const payload: Record<string, unknown> = {
        shopDomain: shopDomain.trim() || null,
        priceUpdateMode,
      };
      if (adminAccessToken.trim().length > 0) {
        payload.adminAccessToken = adminAccessToken.trim();
      }

      const response = await fetch("/api/integrations/shopify", {
        method: "PATCH",
        headers: withCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to save settings");
      }

      setAdminAccessToken("");
      setToast({ tone: "ok", message: "Shopify settings saved" });
      await load();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setToast(null);
    try {
      const response = await fetch("/api/integrations/shopify/test", { method: "POST", headers: withCsrfHeaders() });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Test connection failed");
      }
      if (body.dryRun) {
        setToast({ tone: "ok", message: "DRY_RUN mode: connection simulated" });
      } else {
        setToast({ tone: "ok", message: `Connected to ${body?.shop?.name ?? "Shopify"}` });
      }
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Test connection failed" });
    } finally {
      setTesting(false);
    }
  };

  const onProcessJobs = async () => {
    setProcessing(true);
    setToast(null);
    setLastProcessResult(null);
    try {
      const response = await fetch("/api/shopify/jobs/process", {
        method: "POST",
        headers: withCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ limit: 5 }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to process jobs");
      }
      const processed = Array.isArray(body.processed) ? body.processed : [];
      setLastProcessResult(`Processed ${processed.length} jobs`);
      setToast({ tone: "ok", message: `Processed ${processed.length} Shopify jobs` });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Failed to process jobs" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="detail-grid">
      <section className="content-card">
        <h2>Shopify Integration</h2>
        <p>Configure workspace-level Shopify adapter and push queue behavior.</p>
      </section>

      {toast ? <Toast tone={toast.tone} message={toast.message} /> : null}

      <section className="content-card">
        <h3>Connection Settings</h3>
        {loading ? <p>Loading settings...</p> : null}
        {settings ? (
          <>
            <p>
              Status: {settings.configured ? "Configured" : "Not configured"} | Mode: {settings.priceUpdateMode}
            </p>
            <div className="sku-form">
              <label className="field">
                <span>Shop domain</span>
                <input
                  placeholder="babydocshop.myshopify.com"
                  value={shopDomain}
                  onChange={(event) => setShopDomain(event.target.value)}
                />
              </label>

              <label className="field">
                <span>Admin access token</span>
                <input
                  type="password"
                  placeholder={settings.adminAccessTokenMasked ?? "Enter token"}
                  value={adminAccessToken}
                  onChange={(event) => setAdminAccessToken(event.target.value)}
                />
                <small>{settings.adminAccessTokenMasked ? `Current token: ${settings.adminAccessTokenMasked}` : "No token saved"}</small>
              </label>

              <label className="field">
                <span>Price update mode</span>
                <select value={priceUpdateMode} onChange={(event) => setPriceUpdateMode(event.target.value as "DRY_RUN" | "LIVE") }>
                  <option value="DRY_RUN">DRY_RUN</option>
                  <option value="LIVE">LIVE</option>
                </select>
              </label>

              {priceUpdateMode === "LIVE" ? (
                <p className="form-error">LIVE mode will call Shopify Admin API and attempt real price updates.</p>
              ) : null}

              <div className="row-actions">
                <Button onClick={onSave} loading={saving} loadingText="Saving...">Save</Button>
                <Button variant="secondary" onClick={onTest} loading={testing} loadingText="Testing...">Test connection</Button>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section className="content-card">
        <h3>Job Processor (MVP Manual Worker)</h3>
        <p>Process queued Shopify jobs synchronously for this workspace.</p>
        <div className="row-actions">
          <Button variant="secondary" onClick={onProcessJobs} loading={processing} loadingText="Processing...">
            Process Jobs
          </Button>
        </div>
        {lastProcessResult ? <p className="metric-note">{lastProcessResult}</p> : null}
      </section>
    </div>
  );
}
