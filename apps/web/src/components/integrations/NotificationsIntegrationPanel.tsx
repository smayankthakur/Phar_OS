"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { formatTs } from "@/lib/format";

type SettingsItem = {
  id: string;
  workspaceId: string;
  emailRecipients: string | null;
  emailRecipientCount: number;
  webhookUrlMasked: string | null;
  webhookConfigured: boolean;
  notifyMode: "DRY_RUN" | "LIVE";
  configured: boolean;
  createdAt: string;
  updatedAt: string;
};

type OutboxItem = {
  id: string;
  actionId: string | null;
  type: string;
  status: string;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
};

export function NotificationsIntegrationPanel() {
  const [settings, setSettings] = useState<SettingsItem | null>(null);
  const [emailRecipients, setEmailRecipients] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [notifyMode, setNotifyMode] = useState<"DRY_RUN" | "LIVE">("DRY_RUN");
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ tone: "ok" | "error"; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [settingsRes, outboxRes] = await Promise.all([
        fetch("/api/integrations/notifications", { cache: "no-store" }),
        fetch("/api/notifications/outbox?limit=20", { cache: "no-store" }),
      ]);

      const settingsBody = await settingsRes.json().catch(() => ({}));
      const outboxBody = await outboxRes.json().catch(() => ({}));

      if (!settingsRes.ok) {
        throw new Error(settingsBody?.error?.message ?? "Failed to load notification settings");
      }
      if (!outboxRes.ok) {
        throw new Error(outboxBody?.error?.message ?? "Failed to load notification outbox");
      }

      const item = settingsBody.item as SettingsItem;
      setSettings(item);
      setEmailRecipients(item.emailRecipients ?? "");
      setNotifyMode(item.notifyMode);
      setOutbox((outboxBody.items ?? []) as OutboxItem[]);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Failed to load" });
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
        emailRecipients: emailRecipients.trim() || null,
        notifyMode,
      };
      if (webhookUrl.trim().length > 0) payload.webhookUrl = webhookUrl.trim();

      const response = await fetch("/api/integrations/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to save notification settings");
      }

      setWebhookUrl("");
      setToast({ tone: "ok", message: "Notification settings saved" });
      await load();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setToast(null);
    try {
      const response = await fetch("/api/integrations/notifications/test", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to send test notification");
      }
      setToast({ tone: "ok", message: body.dryRun ? "DRY_RUN test completed" : "Test notification queued/processed" });
      await load();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  const onProcess = async () => {
    setProcessing(true);
    setToast(null);
    try {
      const response = await fetch("/api/notifications/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to process notifications");
      }
      setToast({ tone: "ok", message: `Processed ${Array.isArray(body.processed) ? body.processed.length : 0} outbox entries` });
      await load();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Process failed" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="detail-grid">
      <section className="content-card">
        <h2>Notifications Integration</h2>
        <p>Configure recipients/webhooks and process notification outbox entries.</p>
      </section>

      {toast ? <Toast tone={toast.tone} message={toast.message} /> : null}

      <section className="content-card">
        <h3>Settings</h3>
        {loading ? <p>Loading...</p> : null}
        {settings ? (
          <>
            <p>
              Status: {settings.configured ? "Configured" : "Not configured"} | Mode: {settings.notifyMode}
            </p>
            <div className="sku-form">
              <label className="field">
                <span>Email recipients (comma-separated)</span>
                <input value={emailRecipients} onChange={(event) => setEmailRecipients(event.target.value)} placeholder="ops@client.com, owner@client.com" />
              </label>

              <label className="field">
                <span>Webhook URL (optional)</span>
                <input value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder={settings.webhookUrlMasked ?? "https://example.com/webhook"} />
                <small>{settings.webhookUrlMasked ? `Current webhook: ${settings.webhookUrlMasked}` : "No webhook configured"}</small>
              </label>

              <label className="field">
                <span>Notify mode</span>
                <select value={notifyMode} onChange={(event) => setNotifyMode(event.target.value as "DRY_RUN" | "LIVE") }>
                  <option value="DRY_RUN">DRY_RUN</option>
                  <option value="LIVE">LIVE</option>
                </select>
              </label>

              {notifyMode === "LIVE" ? <p className="form-error">LIVE mode will attempt real SMTP and webhook delivery.</p> : null}

              <div className="row-actions">
                <Button onClick={onSave} loading={saving} loadingText="Saving...">Save</Button>
                <Button variant="secondary" onClick={onTest} loading={testing} loadingText="Testing...">Send Test Notification</Button>
                <Button variant="secondary" onClick={onProcess} loading={processing} loadingText="Processing...">Process Notifications</Button>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section className="content-card">
        <h3>Recent Outbox</h3>
        {outbox.length === 0 ? <p>No notification outbox entries.</p> : null}
        {outbox.length > 0 ? (
          <table className="sku-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Action</th>
                <th>Created</th>
                <th>Sent</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {outbox.map((item) => (
                <tr key={item.id}>
                  <td>{item.type}</td>
                  <td>{item.status}</td>
                  <td>{item.attempts}</td>
                  <td>{item.actionId ?? "-"}</td>
                  <td title={formatTs(item.createdAt).title}>{formatTs(item.createdAt).label}</td>
                  <td>{item.sentAt ? formatTs(item.sentAt).label : "-"}</td>
                  <td>{item.lastError ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}
