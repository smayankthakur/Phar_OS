"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { LoadDemoDatasetButton } from "@/components/LoadDemoDatasetButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { withCsrfHeaders } from "@/lib/csrf-client";

type Competitor = {
  id: string;
  name: string;
  domain: string | null;
  currency: string;
};

type Draft = {
  name: string;
  domain: string;
  currency: string;
};

function emptyDraft(): Draft {
  return { name: "", domain: "", currency: "INR" };
}

export function CompetitorsManagerClient({
  items,
  demoMode = false,
  ownerMode = true,
}: {
  items: Competitor[];
  demoMode?: boolean;
  ownerMode?: boolean;
}) {
  const router = useRouter();
  const [createDraft, setCreateDraft] = useState<Draft>(emptyDraft());
  const [editMap, setEditMap] = useState<Record<string, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/competitors", {
        method: "POST",
        headers: withCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: createDraft.name,
          domain: createDraft.domain || undefined,
          currency: createDraft.currency,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed to create competitor");
      }

      setCreateDraft(emptyDraft());
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create competitor");
    } finally {
      setPending(false);
    }
  };

  const onUpdate = async (id: string) => {
    const draft = editMap[id];
    if (!draft) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/competitors/${id}`, {
        method: "PATCH",
        headers: withCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: draft.name,
          domain: draft.domain || undefined,
          currency: draft.currency,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed to update competitor");
      }

      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update competitor");
    } finally {
      setPending(false);
    }
  };

  const onDelete = async (id: string) => {
    if (demoMode || !ownerMode) return;
    if (!confirm("Delete competitor and all snapshots?")) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/competitors/${id}`, {
        method: "DELETE",
        headers: withCsrfHeaders(),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed to delete competitor");
      }

      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete competitor");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="detail-grid">
      <section className="content-card">
        <h2>Add Competitor</h2>
        <form className="sku-form" onSubmit={onCreate}>
          <label className="field">
            <span>Name</span>
            <input
              value={createDraft.name}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, name: event.target.value }))}
              minLength={2}
              required
            />
          </label>
          <label className="field">
            <span>Domain</span>
            <input
              value={createDraft.domain}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, domain: event.target.value }))}
              placeholder="example.com"
            />
          </label>
          <label className="field">
            <span>Currency</span>
            <input
              value={createDraft.currency}
              onChange={(event) => setCreateDraft((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
              minLength={3}
              maxLength={3}
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          <button className="button-primary" type="submit" disabled={pending}>
            {pending ? "Saving..." : "Create Competitor"}
          </button>
        </form>
      </section>

      <section className="content-card">
        <h2>Competitors</h2>
        <table className="sku-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Domain</th>
              <th>Currency</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    title="No competitors yet"
                    description="Add a competitor manually or load demo data."
                    action={<LoadDemoDatasetButton />}
                  />
                </td>
              </tr>
            ) : null}
            {items.map((item) => {
              const draft = editMap[item.id] ?? {
                name: item.name,
                domain: item.domain ?? "",
                currency: item.currency,
              };

              return (
                <tr key={item.id}>
                  <td>
                    <input
                      className="inline-input"
                      value={draft.name}
                      onChange={(event) =>
                        setEditMap((prev) => ({
                          ...prev,
                          [item.id]: { ...draft, name: event.target.value },
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="inline-input"
                      value={draft.domain}
                      onChange={(event) =>
                        setEditMap((prev) => ({
                          ...prev,
                          [item.id]: { ...draft, domain: event.target.value },
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="inline-input"
                      value={draft.currency}
                      onChange={(event) =>
                        setEditMap((prev) => ({
                          ...prev,
                          [item.id]: { ...draft, currency: event.target.value.toUpperCase() },
                        }))
                      }
                    />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="button-secondary" type="button" onClick={() => onUpdate(item.id)} disabled={pending}>
                        Save
                      </button>
                      <button
                        className="button-danger"
                        type="button"
                        onClick={() => onDelete(item.id)}
                        disabled={pending || demoMode || !ownerMode}
                        title={demoMode ? "Disabled in client demo" : !ownerMode ? "Insufficient permissions" : undefined}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
