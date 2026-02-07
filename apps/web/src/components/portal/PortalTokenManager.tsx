"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { formatTs } from "@/lib/format";

type PortalTokenItem = {
  id: string;
  name: string;
  token: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
};

const EXPIRY_OPTIONS = [
  { label: "Never", value: "never" },
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
] as const;

export function PortalTokenManager() {
  const [items, setItems] = useState<PortalTokenItem[]>([]);
  const [name, setName] = useState("Client Portal Link");
  const [expiry, setExpiry] = useState<(typeof EXPIRY_OPTIONS)[number]["value"]>("30");
  const [loading, setLoading] = useState(true);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "ok" | "error"; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/portal/tokens", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to load tokens");
      }
      setItems((body.items ?? []) as PortalTokenItem[]);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Failed to load tokens" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const appOrigin = useMemo(() => {
    if (typeof window === "undefined") return "";
    const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
    return fromEnv && fromEnv.length > 0 ? fromEnv : window.location.origin;
  }, []);

  const onCreate = async () => {
    if (name.trim().length < 2) {
      setToast({ tone: "error", message: "Token name must be at least 2 characters" });
      return;
    }

    setPendingCreate(true);
    setToast(null);

    try {
      const payload = {
        name: name.trim(),
        expiresInDays: expiry === "never" ? undefined : Number(expiry),
      };

      const response = await fetch("/api/portal/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to create token");
      }

      setToast({ tone: "ok", message: "Portal token created" });
      await load();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Failed to create token" });
    } finally {
      setPendingCreate(false);
    }
  };

  const onRevoke = async (id: string) => {
    setPendingRevokeId(id);
    setToast(null);

    try {
      const response = await fetch(`/api/portal/tokens/${id}/revoke`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to revoke token");
      }

      setToast({ tone: "ok", message: "Token revoked" });
      await load();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Failed to revoke token" });
    } finally {
      setPendingRevokeId(null);
    }
  };

  const onCopy = async (token: string) => {
    try {
      const url = `${appOrigin}/portal/${token}`;
      await navigator.clipboard.writeText(url);
      setToast({ tone: "ok", message: "Portal link copied" });
    } catch {
      setToast({ tone: "error", message: "Failed to copy link" });
    }
  };

  return (
    <div className="detail-grid">
      <section className="content-card">
        <h2>Client Portal Access</h2>
        <p>Create read-only tokenized links for client reporting views.</p>
      </section>

      {toast ? <Toast tone={toast.tone} message={toast.message} /> : null}

      <section className="content-card">
        <h3>Create Token</h3>
        <div className="sku-form">
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field">
            <span>Expiry</span>
            <select value={expiry} onChange={(event) => setExpiry(event.target.value as (typeof EXPIRY_OPTIONS)[number]["value"])}>
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="row-actions">
            <Button onClick={onCreate} loading={pendingCreate} loadingText="Creating...">
              Create Token
            </Button>
          </div>
        </div>
      </section>

      <section className="content-card">
        <h3>Tokens</h3>
        {loading ? <p>Loading tokens...</p> : null}
        {!loading && items.length === 0 ? <p>No portal tokens yet.</p> : null}

        {items.length > 0 ? (
          <table className="sku-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.status}</td>
                  <td title={formatTs(item.createdAt).title}>{formatTs(item.createdAt).label}</td>
                  <td>{item.expiresAt ? formatTs(item.expiresAt).label : "Never"}</td>
                  <td>
                    <div className="row-actions">
                      <Button variant="secondary" onClick={() => onCopy(item.token)} disabled={item.status !== "ACTIVE"}>
                        Copy link
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => onRevoke(item.id)}
                        loading={pendingRevokeId === item.id}
                        loadingText="Revoking..."
                        disabled={item.status !== "ACTIVE"}
                      >
                        Revoke
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}
