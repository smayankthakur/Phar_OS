"use client";

import { useEffect, useState } from "react";

type AuditDetail = {
  id: string;
  actorEmail: string | null;
  actionId: string | null;
  entityType: string;
  entityId: string;
  event: string;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export function AuditModal({ auditId, onClose }: { auditId: string; onClose: () => void }) {
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAudit() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/audits/${auditId}`);
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? "Failed to load audit");
        }
        const body = await response.json();
        if (active) setAudit(body.audit);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Failed to load audit");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAudit();

    return () => {
      active = false;
    };
  }, [auditId]);

  return (
    <div className="audit-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="audit-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="audit-modal-header">
          <h3>{audit ? `Audit - ${audit.event}` : "Audit"}</h3>
          <button type="button" className="button-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {loading ? <p>Loading audit...</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        {audit ? (
          <>
            <div className="audit-meta">
              <p>Actor: {audit.actorEmail ?? "system"}</p>
              <p>Created: {new Date(audit.createdAt).toLocaleString()}</p>
              <p>Entity: {audit.entityType} / {audit.entityId}</p>
            </div>
            <div className="two-col">
              <section className="content-card">
                <h4>Before</h4>
                <pre className="json-view">{JSON.stringify(audit.before, null, 2)}</pre>
              </section>
              <section className="content-card">
                <h4>After</h4>
                <pre className="json-view">{JSON.stringify(audit.after, null, 2)}</pre>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
