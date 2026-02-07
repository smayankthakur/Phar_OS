"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table } from "@/components/ui/Table";
import { Toast } from "@/components/ui/Toast";
import { withCsrfHeaders } from "@/lib/csrf-client";

type ImportTab = "skus" | "competitors" | "snapshots";

type PreviewError = {
  idx: number;
  field: string;
  message: string;
};

type PreviewResponse = {
  rows: Array<Record<string, unknown>>;
  errors: PreviewError[];
  summary: Record<string, unknown>;
};

const TAB_META: Record<ImportTab, { label: string; templateHref: string; previewUrl: string; commitUrl: string }> = {
  skus: {
    label: "SKUs",
    templateHref: "/api/templates/skus.csv",
    previewUrl: "/api/import/skus/preview",
    commitUrl: "/api/import/skus/commit",
  },
  competitors: {
    label: "Competitors",
    templateHref: "/api/templates/competitors.csv",
    previewUrl: "/api/import/competitors/preview",
    commitUrl: "/api/import/competitors/commit",
  },
  snapshots: {
    label: "Snapshots (Bulk by SKU)",
    templateHref: "/api/templates/snapshots.csv",
    previewUrl: "/api/import/snapshots/preview",
    commitUrl: "/api/import/snapshots/commit",
  },
};

function pretty(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value == null) return "-";
  return String(value);
}

export function ImportCenter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ImportTab>("skus");
  const [csvText, setCsvText] = useState("");
  const [createMissingCompetitors, setCreateMissingCompetitors] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [pendingPreview, setPendingPreview] = useState(false);
  const [pendingCommit, setPendingCommit] = useState(false);
  const [toast, setToast] = useState<{ tone: "ok" | "error"; message: string } | null>(null);

  const currentMeta = TAB_META[tab];
  const rows = useMemo(() => preview?.rows ?? [], [preview]);
  const columns = useMemo(() => {
    const first = rows[0];
    if (!first) return [] as string[];
    return Object.keys(first);
  }, [rows]);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setCsvText(content);
    setPreview(null);
  };

  const makeBody = () => ({
    csvText,
    options: tab === "snapshots" ? { createMissingCompetitors } : undefined,
  });

  const onPreview = async () => {
    setPendingPreview(true);
    setToast(null);
    try {
      const response = await fetch(currentMeta.previewUrl, {
        method: "POST",
        headers: withCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(makeBody()),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Preview failed");
      }
      setPreview(body.preview as PreviewResponse);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Preview failed" });
    } finally {
      setPendingPreview(false);
    }
  };

  const onCommit = async () => {
    if (!preview) return;
    setPendingCommit(true);
    setToast(null);
    try {
      const response = await fetch(currentMeta.commitUrl, {
        method: "POST",
        headers: withCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(makeBody()),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Commit failed");
      }

      const imported = Number(body.importedCount ?? 0);
      const skipped = Number(body.skippedCount ?? 0);
      const updated = Number(body.updatedCount ?? 0);
      const created = Number(body.createdCount ?? 0);
      const createdCompetitors = Number(body.createdCompetitorsCount ?? 0);

      const parts = [`Imported ${imported}`];
      if (updated > 0) parts.push(`updated ${updated}`);
      if (created > 0) parts.push(`created ${created}`);
      if (createdCompetitors > 0) parts.push(`created competitors ${createdCompetitors}`);
      parts.push(`skipped ${skipped}`);

      setToast({ tone: "ok", message: parts.join(" | ") });
      setPreview(null);
      router.refresh();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Commit failed" });
    } finally {
      setPendingCommit(false);
    }
  };

  const onboarded = searchParams.get("onboarded") === "1";
  const workspaceId = searchParams.get("workspaceId");

  return (
    <div className="detail-grid">
      <section className="content-card">
        <h2>Import Center</h2>
        <p>Upload CSVs with preview-first validation before committing data to this workspace.</p>
        <div className="row-actions">
          {Object.entries(TAB_META).map(([key, item]) => (
            <Button
              key={key}
              variant={tab === key ? "primary" : "secondary"}
              onClick={() => {
                setTab(key as ImportTab);
                setPreview(null);
                setToast(null);
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </section>

      {onboarded ? (
        <section className="content-card">
          <h3>Workspace ready</h3>
          <p>Workspace created successfully. Continue setup with imports and guardrails.</p>
          <div className="row-actions">
            <Link href="/settings" className="button-secondary">
              Open Settings
            </Link>
            <Link href="/skus" className="button-secondary">
              Open SKUs
            </Link>
            <Link href="/" className="button-secondary">
              Open Command Center
            </Link>
          </div>
          {workspaceId ? <p className="metric-note">Workspace ID: {workspaceId}</p> : null}
        </section>
      ) : null}

      {toast ? <Toast tone={toast.tone} message={toast.message} /> : null}

      <section className="content-card">
        <h3>{currentMeta.label} CSV</h3>
        <div className="row-actions">
          <a className="button-secondary" href={currentMeta.templateHref}>
            Download template
          </a>
        </div>

        <div className="sku-form">
          <label className="field">
            <span>Upload CSV file</span>
            <input type="file" accept=".csv,text/csv" onChange={onFile} />
          </label>

          <label className="field">
            <span>Or paste CSV text</span>
            <textarea
              className="json-editor"
              rows={10}
              value={csvText}
              onChange={(event) => {
                setCsvText(event.target.value);
                setPreview(null);
              }}
            />
          </label>

          {tab === "snapshots" ? (
            <label className="field check-field">
              <input
                type="checkbox"
                checked={createMissingCompetitors}
                onChange={(event) => setCreateMissingCompetitors(event.target.checked)}
              />
              <span>Create missing competitors</span>
            </label>
          ) : null}

          <div className="row-actions">
            <Button variant="secondary" onClick={onPreview} loading={pendingPreview} loadingText="Previewing..." disabled={!csvText.trim()}>
              Preview
            </Button>
            <Button onClick={onCommit} loading={pendingCommit} loadingText="Committing..." disabled={!preview || rows.length === 0}>
              Commit
            </Button>
          </div>
        </div>
      </section>

      {preview ? (
        <>
          <section className="content-card">
            <h4>Summary</h4>
            <ul>
              {Object.entries(preview.summary).map(([key, value]) => (
                <li key={key}>
                  {key}: {pretty(value)}
                </li>
              ))}
            </ul>
          </section>

          <section className="content-card">
            <h4>Preview rows</h4>
            {rows.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row, idx) => (
                    <tr key={idx}>
                      {columns.map((col) => (
                        <td key={`${idx}-${col}`}>{pretty(row[col])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="No valid rows" description="Fix CSV issues and preview again." />
            )}
          </section>

          <section className="content-card">
            <h4>Errors</h4>
            {preview.errors.length > 0 ? (
              <ul>
                {preview.errors.slice(0, 100).map((item, idx) => (
                  <li key={`${item.idx}-${item.field}-${idx}`}>
                    Row {item.idx}, {item.field}: {item.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No validation errors.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
