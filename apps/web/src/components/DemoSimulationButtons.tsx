"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { withCsrfHeaders } from "@/lib/csrf-client";

type SimulationType = "COMPETITOR_PRICE_DROP" | "COST_INCREASE" | "STOCK_LOW";

const BUTTONS: Array<{ label: string; type: SimulationType }> = [
  { label: "Competitor Price Drop", type: "COMPETITOR_PRICE_DROP" },
  { label: "Cost Increase", type: "COST_INCREASE" },
  { label: "Stock Low", type: "STOCK_LOW" },
];

export function DemoSimulationButtons() {
  const router = useRouter();
  const [pendingType, setPendingType] = useState<SimulationType | null>(null);

  const runSimulation = async (type: SimulationType) => {
    setPendingType(type);

    try {
      await fetch("/api/demo/simulate", {
        method: "POST",
        headers: withCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ type }),
      });
      router.refresh();
    } finally {
      setPendingType(null);
    }
  };

  return (
    <div className="row-actions">
      {BUTTONS.map((button) => (
        <button
          key={button.type}
          className="button-secondary"
          type="button"
          onClick={() => runSimulation(button.type)}
          disabled={pendingType !== null}
        >
          {pendingType === button.type ? "Running..." : button.label}
        </button>
      ))}
    </div>
  );
}
