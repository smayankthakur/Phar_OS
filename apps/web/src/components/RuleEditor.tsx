"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { withCsrfHeaders } from "@/lib/csrf-client";

type EventType = "COMPETITOR_PRICE_DROP" | "COST_INCREASE" | "STOCK_LOW";
type ActionType = "PRICE_MATCH" | "PRICE_INCREASE" | "NOTIFY";

type RulePayload = {
  name: string;
  eventType: EventType;
  enabled: boolean;
  condition: Record<string, unknown>;
  actionTemplate: {
    type: ActionType;
    params: Record<string, unknown>;
  };
};

type RulePreset = {
  key: string;
  label: string;
  payload: RulePayload;
};

const PRESETS: RulePreset[] = [
  {
    key: "PRICE_DROP",
    label: "Competitor price drop -> Price match",
    payload: {
      name: "Rule A - Competitor Price Drop -> Price Match",
      eventType: "COMPETITOR_PRICE_DROP",
      enabled: true,
      condition: { op: "lt", left: "payload.newPrice", right: "sku.currentPrice" },
      actionTemplate: { type: "PRICE_MATCH", params: {} },
    },
  },
  {
    key: "COST_UP",
    label: "Cost increase -> Price increase",
    payload: {
      name: "Rule B - Cost Increase -> Price Increase",
      eventType: "COST_INCREASE",
      enabled: true,
      condition: { op: "gt", left: "payload.newCost", right: "payload.oldCost" },
      actionTemplate: { type: "PRICE_INCREASE", params: {} },
    },
  },
  {
    key: "STOCK_LOW",
    label: "Stock low -> Notify",
    payload: {
      name: "Rule C - Stock Low -> Notify",
      eventType: "STOCK_LOW",
      enabled: true,
      condition: { op: "lt", left: "payload.available", right: "payload.threshold" },
      actionTemplate: { type: "NOTIFY", params: {} },
    },
  },
];

export function RuleEditor({
  mode,
  initial,
  ruleId,
  demoMode = false,
  ownerMode = true,
}: {
  mode: "create" | "edit";
  initial?: RulePayload;
  ruleId?: string;
  demoMode?: boolean;
  ownerMode?: boolean;
}) {
  const router = useRouter();
  const fallback = initial ?? PRESETS[0].payload;
  const [presetKey, setPresetKey] = useState(PRESETS[0].key);
  const [name, setName] = useState(fallback.name);
  const [eventType, setEventType] = useState<EventType>(fallback.eventType);
  const [enabled, setEnabled] = useState(fallback.enabled);
  const [conditionText, setConditionText] = useState(JSON.stringify(fallback.condition, null, 2));
  const [templateText, setTemplateText] = useState(JSON.stringify(fallback.actionTemplate, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const endpoint = useMemo(() => (mode === "create" ? "/api/rules" : `/api/rules/${ruleId}`), [mode, ruleId]);
  const method = mode === "create" ? "POST" : "PATCH";

  const applyPreset = (key: string) => {
    const selected = PRESETS.find((item) => item.key === key);
    if (!selected) return;

    setPresetKey(key);
    setName(selected.payload.name);
    setEventType(selected.payload.eventType);
    setEnabled(selected.payload.enabled);
    setConditionText(JSON.stringify(selected.payload.condition, null, 2));
    setTemplateText(JSON.stringify(selected.payload.actionTemplate, null, 2));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const condition = JSON.parse(conditionText);
      const actionTemplate = JSON.parse(templateText);

      const payload = {
        name,
        eventType,
        enabled,
        condition,
        actionTemplate,
      };

      const response = await fetch(endpoint, {
        method,
        headers: withCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed to save rule");
      }

      router.push("/rules");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save rule");
    } finally {
      setPending(false);
    }
  };

  const onDelete = async () => {
    if (demoMode || !ownerMode) return;
    if (!ruleId || !confirm("Delete this rule?")) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/rules/${ruleId}`, { method: "DELETE", headers: withCsrfHeaders() });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed to delete rule");
      }

      router.push("/rules");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to delete rule");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="content-card">
      <h2>{mode === "create" ? "New Rule" : "Edit Rule"}</h2>
      <form className="sku-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Preset</span>
          <select
            value={presetKey}
            onChange={(event) => {
              const key = event.target.value;
              setPresetKey(key);
              applyPreset(key);
            }}
          >
            {PRESETS.map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} required />
        </label>

        <label className="field">
          <span>Event Type</span>
          <select value={eventType} onChange={(event) => setEventType(event.target.value as EventType)}>
            <option value="COMPETITOR_PRICE_DROP">COMPETITOR_PRICE_DROP</option>
            <option value="COST_INCREASE">COST_INCREASE</option>
            <option value="STOCK_LOW">STOCK_LOW</option>
          </select>
        </label>

        <label className="field check-field">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          <span>Enabled</span>
        </label>

        <label className="field">
          <span>Condition JSON</span>
          <textarea className="json-editor" value={conditionText} onChange={(event) => setConditionText(event.target.value)} rows={7} />
        </label>

        <label className="field">
          <span>Action Template JSON</span>
          <textarea className="json-editor" value={templateText} onChange={(event) => setTemplateText(event.target.value)} rows={6} />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="row-actions">
          <button
            className="button-primary"
            type="submit"
            disabled={pending || !ownerMode}
            title={!ownerMode ? "Insufficient permissions" : undefined}
          >
            {pending ? "Saving..." : mode === "create" ? "Create Rule" : "Save Rule"}
          </button>
          {mode === "edit" ? (
            <button
              className="button-danger"
              type="button"
              onClick={onDelete}
              disabled={pending || demoMode || !ownerMode}
              title={demoMode ? "Disabled in client demo" : !ownerMode ? "Insufficient permissions" : undefined}
            >
              Delete Rule
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
