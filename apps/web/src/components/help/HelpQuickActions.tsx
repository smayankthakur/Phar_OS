"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";

type SimulationType = "COMPETITOR_PRICE_DROP" | "COST_INCREASE" | "STOCK_LOW";

export function HelpQuickActions({ clientDemoMode }: { clientDemoMode: boolean }) {
  const router = useRouter();
  const [simType, setSimType] = useState<SimulationType>("COMPETITOR_PRICE_DROP");
  const [pendingReset, setPendingReset] = useState(false);
  const [pendingSim, setPendingSim] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "error" } | null>(null);

  const onReset = async () => {
    setPendingReset(true);
    setToast(null);
    try {
      const response = await fetch("/api/demo/reset", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message ?? "Reset failed");
      setToast({ message: "Demo dataset loaded", tone: "ok" });
      router.refresh();
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Reset failed", tone: "error" });
    } finally {
      setPendingReset(false);
    }
  };

  const onSimulate = async () => {
    setPendingSim(true);
    setToast(null);
    try {
      const response = await fetch("/api/demo/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: simType }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message ?? "Simulation failed");
      setToast({ message: "Simulation completed", tone: "ok" });
      router.refresh();
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Simulation failed", tone: "error" });
    } finally {
      setPendingSim(false);
    }
  };

  return (
    <div className="detail-grid">
      <div className="quick-actions">
        <Button
          variant="secondary"
          onClick={onReset}
          loading={pendingReset}
          loadingText="Resetting..."
          disabled={clientDemoMode}
          title={clientDemoMode ? "Disabled in client demo. Use /demo to reset dataset." : undefined}
        >
          Reset Demo
        </Button>
        <select value={simType} onChange={(event) => setSimType(event.target.value as SimulationType)}>
          <option value="COMPETITOR_PRICE_DROP">Competitor Drop</option>
          <option value="COST_INCREASE">Cost Increase</option>
          <option value="STOCK_LOW">Stock Low</option>
        </select>
        <Button variant="secondary" onClick={onSimulate} loading={pendingSim} loadingText="Running...">
          Run Simulation
        </Button>
        <Link href="/" className="button-secondary">
          Command Center
        </Link>
        <Link href="/settings" className="button-secondary">
          Guardrails Settings
        </Link>
      </div>
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </div>
  );
}
