"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table } from "@/components/ui/Table";
import { Toast } from "@/components/ui/Toast";
import { formatMoney, formatTs } from "@/lib/format";

type PreviewRow = {
  idx: number;
  competitorName: string;
  price: number;
  capturedAtISO: string;
  competitorExists: boolean;
  valid: boolean;
};

type PreviewError = {
  idx: number;
  field: string;
  message: string;
};

type PreviewSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  missingCompetitorsCount: number;
  csvImportLimit: number;
};

type PreviewData = {
  rows: PreviewRow[];
  errors: PreviewError[];
  summary: PreviewSummary;
};

export function SnapshotCsvImport({ skuId }: { skuId: string }) {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [createMissingCompetitors, setCreateMissingCompetitors] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [pendingPreview, setPendingPreview] = useState(false);
  const [pendingCommit, setPendingCommit] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "error" } | null>(null);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setCsvText(content);
    setPreview(null);
  };

  const onPreview = async () => {
    setPendingPreview(true);
    setToast(null);
    try {
      const response = await fetch(`/api/skus/${skuId}/snapshots/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, createMissingCompetitors }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Preview failed");
      }
      setPreview(body.preview as PreviewData);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Preview failed", tone: "error" });
    } finally {
      setPendingPreview(false);
    }
  };

  const onCommit = async () => {
    setPendingCommit(true);
    setToast(null);
    try {
      const response = await fetch(`/api/skus/${skuId}/snapshots/import/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, createMissingCompetitors }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Commit failed");
      }
      setToast({
        message: `Imported ${body.importedCount} snapshots (${body.skippedCount} skipped)${
          body.createdCompetitorsCount ? `, created ${body.createdCompetitorsCount} competitors` : ""
        }`,
        tone: "ok",
      });
      router.refresh();
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Commit failed", tone: "error" });
    } finally {
      setPendingCommit(false);
    }
  };

  return (
    <section className="content-card">
      <h4>Import CSV</h4>
      <p className="metric-note">Required headers: competitor_name, price. Optional: captured_at, currency, note.</p>

      <div className="sku-form">
        <label className="field">
          <span>Upload CSV file</span>
          <input type="file" accept=".csv,text/csv" onChange={onFile} />
        </label>

        <label className="field">
          <span>Or paste CSV text</span>
          <textarea
            className="json-editor"
            rows={8}
            value={csvText}
            onChange={(event) => {
              setCsvText(event.target.value);
              setPreview(null);
            }}
            placeholder={"competitor_name,price,captured_at\nDemoMart,115,2026-02-01\nPriceKing,123,2026-02-02"}
          />
        </label>

        <label className="field check-field">
          <input
            type="checkbox"
            checked={createMissingCompetitors}
            onChange={(event) => setCreateMissingCompetitors(event.target.checked)}
          />
          <span>Create missing competitors</span>
        </label>

        <div className="row-actions">
          <Button variant="secondary" onClick={onPreview} loading={pendingPreview} loadingText="Parsing...">
            Preview
          </Button>
          <Button
            onClick={onCommit}
            loading={pendingCommit}
            loadingText="Importing..."
            disabled={!preview || preview.summary.validRows <= 0}
          >
            Commit Import
          </Button>
        </div>
      </div>

      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}

      {preview ? (
        <div className="detail-grid">
          <div className="content-card">
            <p>Total rows: {preview.summary.totalRows}</p>
            <p>Valid rows: {preview.summary.validRows}</p>
            <p>Invalid rows: {preview.summary.invalidRows}</p>
            <p>Missing competitors: {preview.summary.missingCompetitorsCount}</p>
            <p>Import limit: {preview.summary.csvImportLimit}</p>
          </div>

          {preview.errors.length > 0 ? (
            <div className="content-card">
              <h5>Errors</h5>
              <ul>
                {preview.errors.slice(0, 100).map((error) => (
                  <li key={`${error.idx}-${error.field}-${error.message}`}>
                    Row {error.idx}, {error.field}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.rows.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Competitor</th>
                  <th>Exists</th>
                  <th>Price</th>
                  <th>Captured</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.idx}>
                    <td>{row.idx}</td>
                    <td>{row.competitorName}</td>
                    <td>{row.competitorExists ? "Yes" : "No"}</td>
                    <td>{formatMoney(row.price)}</td>
                    <td title={formatTs(row.capturedAtISO).title}>{formatTs(row.capturedAtISO).label}</td>
                    <td>{row.valid ? "Valid" : "Invalid"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="No preview rows" description="Upload a CSV and click Preview." />
          )}
        </div>
      ) : null}
    </section>
  );
}
