"use client";

import { useEffect, useState } from "react";
import { Toast } from "@/components/ui/Toast";

type HealthState = { ok: boolean; db: boolean; ts: string } | null;

export function SystemStatusCard({
  workspaceId,
  workspaceName,
  demoMode,
}: {
  workspaceId: string;
  workspaceName: string;
  demoMode: boolean;
}) {
  const [health, setHealth] = useState<HealthState>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body?.error?.message ?? "Health check failed");
        }
        if (active) setHealth(body);
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Health check failed");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="content-card">
      <h3>System Status</h3>
      <p>Workspace: {workspaceName}</p>
      <p>Workspace ID: {workspaceId}</p>
      <p>Client Demo Mode: {demoMode ? "ON" : "OFF"}</p>
      <p>Health: {health ? (health.ok && health.db ? "Healthy" : "Unhealthy") : "Checking..."}</p>
      <p>DB: {health ? (health.db ? "Connected" : "Disconnected") : "Checking..."}</p>
      {error ? <Toast message={error} tone="error" /> : null}
    </section>
  );
}
