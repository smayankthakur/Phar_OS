"use client";

import { useMemo, useState } from "react";
import { withCsrfHeaders } from "@/lib/csrf-client";

type Role = "RESELLER_OWNER" | "RESELLER_ADMIN" | "RESELLER_SUPPORT";
type PlanTier = "STARTER" | "PRO" | "AGENCY" | "ENTERPRISE";

type ResellerDTO = {
  id: string;
  name: string;
  brandName: string | null;
  appName: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  supportEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

type DomainDTO = {
  id: string;
  domain: string;
  target: string;
  verifiedAt: string | null;
  createdAt: string;
};

type WorkspaceDTO = {
  id: string;
  name: string;
  createdAt: string;
  plan: string | null;
  status: string | null;
  planOverride: PlanTier | null;
  billingManagedByReseller: boolean;
  usage: null | {
    yearMonth: string;
    seatsUsed: number;
    skusUsed: number;
    competitorsUsed: number;
    snapshotImportRowsUsed: number;
    portalTokensUsed: number;
  };
};

async function postJson(path: string, body: Record<string, unknown>, method: "POST" | "PATCH" = "POST") {
  const response = await fetch(path, {
    method,
    headers: withCsrfHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export function ResellerDashboardClient(props:
  | { mode: "create" }
  | {
      mode: "dashboard";
      role: Role;
      reseller: ResellerDTO | null;
      domains: DomainDTO[];
      workspaces: WorkspaceDTO[];
    }) {
  const [tab, setTab] = useState<"clients" | "branding" | "domains">("clients");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const role = props.mode === "dashboard" ? props.role : null;
  const canEdit = role === "RESELLER_OWNER" || role === "RESELLER_ADMIN";

  const headerNote = useMemo(() => {
    if (props.mode !== "dashboard") return null;
    return `Role: ${props.role}`;
  }, [props]);

  const createReseller = async (name: string) => {
    setError(null);
    setNotice(null);
    setPending("create-reseller");
    try {
      const { response, payload } = await postJson("/api/reseller/create", { name });
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "Failed to create reseller");
        return;
      }
      window.location.reload();
    } finally {
      setPending(null);
    }
  };

  if (props.mode === "create") {
    return <CreateResellerForm onCreate={createReseller} pending={pending !== null} error={error} />;
  }

  const saveBranding = async (input: {
    brandName: string;
    appName: string;
    logoUrl: string;
    accentColor: string;
    supportEmail: string;
  }) => {
    setError(null);
    setNotice(null);
    setPending("branding");
    try {
      const { response, payload } = await postJson(
        "/api/reseller/branding",
        {
          brandName: input.brandName || null,
          appName: input.appName || null,
          logoUrl: input.logoUrl || null,
          accentColor: input.accentColor || null,
          supportEmail: input.supportEmail || null,
        },
        "PATCH",
      );
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "Failed to save branding");
        return;
      }
      setNotice("Branding updated");
      window.location.reload();
    } finally {
      setPending(null);
    }
  };

  const addDomain = async (domain: string, target: "APP" | "PORTAL") => {
    setError(null);
    setNotice(null);
    setPending("domain");
    try {
      const { response, payload } = await postJson("/api/reseller/domains", { domain, target }, "POST");
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "Failed to add domain");
        return;
      }
      setNotice("Domain added");
      window.location.reload();
    } finally {
      setPending(null);
    }
  };

  const verifyDomain = async (domainId: string) => {
    setError(null);
    setNotice(null);
    setPending(`verify:${domainId}`);
    try {
      const { response, payload } = await postJson(`/api/reseller/domains/${domainId}/verify`, {}, "POST");
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "Failed to verify domain");
        return;
      }
      setNotice("Domain marked verified");
      window.location.reload();
    } finally {
      setPending(null);
    }
  };

  const createClientWorkspace = async (name: string, method: "CLONE_DEMO" | "EMPTY") => {
    setError(null);
    setNotice(null);
    setPending("create-workspace");
    try {
      const { response, payload } = await postJson("/api/reseller/workspaces/create", { name, method }, "POST");
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "Failed to create workspace");
        return;
      }
      setNotice("Client workspace created");
      window.location.reload();
    } finally {
      setPending(null);
    }
  };

  const setPlanOverride = async (workspaceId: string, planOverride: PlanTier | null, billingManagedByReseller: boolean) => {
    setError(null);
    setNotice(null);
    setPending(`override:${workspaceId}`);
    try {
      const { response, payload } = await postJson(
        `/api/reseller/workspaces/${workspaceId}/plan-override`,
        { planOverride, billingManagedByReseller },
        "PATCH",
      );
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "Failed to set override");
        return;
      }
      setNotice("Override updated");
      window.location.reload();
    } finally {
      setPending(null);
    }
  };

  return (
    <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
      <div className="page-intro">
        <div>
          <h2 style={{ marginTop: 0 }}>{props.reseller?.brandName ?? props.reseller?.name ?? "Reseller"}</h2>
          <p style={{ margin: "0.35rem 0 0" }}>{headerNote}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className="button-primary" onClick={() => setTab("clients")}>
            Clients
          </button>
          <button className="button-primary" onClick={() => setTab("branding")}>
            Branding
          </button>
          <button className="button-primary" onClick={() => setTab("domains")}>
            Domains
          </button>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="metric-note">{notice}</p> : null}

      {tab === "clients" ? (
        <ClientsTab
          canEdit={canEdit}
          workspaces={props.workspaces}
          pending={pending}
          onCreateWorkspace={createClientWorkspace}
          onSetPlanOverride={setPlanOverride}
        />
      ) : null}

      {tab === "branding" ? (
        <BrandingTab canEdit={canEdit} reseller={props.reseller} pending={pending} onSave={saveBranding} />
      ) : null}

      {tab === "domains" ? (
        <DomainsTab canEdit={canEdit} domains={props.domains} pending={pending} onAdd={addDomain} onVerify={verifyDomain} />
      ) : null}
    </div>
  );
}

function CreateResellerForm({
  onCreate,
  pending,
  error,
}: {
  onCreate: (name: string) => void;
  pending: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("PharOS Reseller");
  return (
    <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
      <label className="field">
        <span>Reseller Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} minLength={3} required />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button-primary" disabled={pending} onClick={() => onCreate(name)}>
        {pending ? "Creating..." : "Create reseller account"}
      </button>
    </div>
  );
}

function BrandingTab({
  canEdit,
  reseller,
  pending,
  onSave,
}: {
  canEdit: boolean;
  reseller: ResellerDTO | null;
  pending: string | null;
  onSave: (input: { brandName: string; appName: string; logoUrl: string; accentColor: string; supportEmail: string }) => void;
}) {
  const [brandName, setBrandName] = useState(reseller?.brandName ?? "");
  const [appName, setAppName] = useState(reseller?.appName ?? "");
  const [logoUrl, setLogoUrl] = useState(reseller?.logoUrl ?? "");
  const [accentColor, setAccentColor] = useState(reseller?.accentColor ?? "");
  const [supportEmail, setSupportEmail] = useState(reseller?.supportEmail ?? "");

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <h3 style={{ margin: 0 }}>Branding</h3>
      <label className="field">
        <span>Brand Name</span>
        <input value={brandName} onChange={(event) => setBrandName(event.target.value)} disabled={!canEdit} />
      </label>
      <label className="field">
        <span>App Name Override</span>
        <input value={appName} onChange={(event) => setAppName(event.target.value)} disabled={!canEdit} />
      </label>
      <label className="field">
        <span>Logo URL</span>
        <input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} disabled={!canEdit} />
      </label>
      <label className="field">
        <span>Accent Color (hex)</span>
        <input value={accentColor} onChange={(event) => setAccentColor(event.target.value)} disabled={!canEdit} placeholder="#2d4f8f" />
      </label>
      <label className="field">
        <span>Support Email</span>
        <input value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} disabled={!canEdit} />
      </label>
      <button
        className="button-primary"
        disabled={!canEdit || pending === "branding"}
        onClick={() => onSave({ brandName, appName, logoUrl, accentColor, supportEmail })}
      >
        {pending === "branding" ? "Saving..." : canEdit ? "Save branding" : "Read-only"}
      </button>
    </div>
  );
}

function DomainsTab({
  canEdit,
  domains,
  pending,
  onAdd,
  onVerify,
}: {
  canEdit: boolean;
  domains: DomainDTO[];
  pending: string | null;
  onAdd: (domain: string, target: "APP" | "PORTAL") => void;
  onVerify: (domainId: string) => void;
}) {
  const [domain, setDomain] = useState("");
  const [target, setTarget] = useState<"APP" | "PORTAL">("APP");

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <h3 style={{ margin: 0 }}>Domains</h3>
      <div className="list-toolbar" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input className="search-input" placeholder="client.yourdomain.com" value={domain} onChange={(e) => setDomain(e.target.value)} disabled={!canEdit} />
        <select className="switcher-select" value={target} onChange={(e) => setTarget(e.target.value as "APP" | "PORTAL")} disabled={!canEdit}>
          <option value="APP">APP</option>
          <option value="PORTAL">PORTAL</option>
        </select>
        <button className="button-primary" disabled={!canEdit || pending === "domain"} onClick={() => onAdd(domain, target)}>
          {pending === "domain" ? "Adding..." : "Add domain"}
        </button>
      </div>

      <table className="sku-table">
        <thead>
          <tr>
            <th>Domain</th>
            <th>Target</th>
            <th>Verified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((d) => (
            <tr key={d.id}>
              <td>{d.domain}</td>
              <td>{d.target}</td>
              <td>{d.verifiedAt ? "Yes" : "No"}</td>
              <td>
                <button className="button-primary" disabled={!canEdit || !!d.verifiedAt || pending === `verify:${d.id}`} onClick={() => onVerify(d.id)}>
                  {pending === `verify:${d.id}` ? "Verifying..." : d.verifiedAt ? "Verified" : "Mark verified"}
                </button>
              </td>
            </tr>
          ))}
          {domains.length === 0 ? (
            <tr>
              <td colSpan={4}>
                <p className="metric-note">No domains yet.</p>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function ClientsTab({
  canEdit,
  workspaces,
  pending,
  onCreateWorkspace,
  onSetPlanOverride,
}: {
  canEdit: boolean;
  workspaces: WorkspaceDTO[];
  pending: string | null;
  onCreateWorkspace: (name: string, method: "CLONE_DEMO" | "EMPTY") => void;
  onSetPlanOverride: (workspaceId: string, planOverride: PlanTier | null, billingManagedByReseller: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [method, setMethod] = useState<"CLONE_DEMO" | "EMPTY">("EMPTY");

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <h3 style={{ margin: 0 }}>Client Workspaces</h3>

      <div className="list-toolbar" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input className="search-input" placeholder="Client workspace name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
        <select className="switcher-select" value={method} onChange={(e) => setMethod(e.target.value as "CLONE_DEMO" | "EMPTY")} disabled={!canEdit}>
          <option value="EMPTY">Start empty</option>
          <option value="CLONE_DEMO">Clone demo dataset</option>
        </select>
        <button className="button-primary" disabled={!canEdit || pending === "create-workspace"} onClick={() => onCreateWorkspace(name || "Client Workspace", method)}>
          {pending === "create-workspace" ? "Creating..." : "Create client workspace"}
        </button>
      </div>

      <table className="sku-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Plan</th>
            <th>Status</th>
            <th>Override</th>
            <th>Reseller Billing</th>
            <th>Usage (latest month)</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {workspaces.map((w) => (
            <ClientRow key={w.id} canEdit={canEdit} workspace={w} pending={pending} onSetPlanOverride={onSetPlanOverride} />
          ))}
          {workspaces.length === 0 ? (
            <tr>
              <td colSpan={7}>
                <p className="metric-note">No client workspaces yet.</p>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function ClientRow({
  canEdit,
  workspace,
  pending,
  onSetPlanOverride,
}: {
  canEdit: boolean;
  workspace: WorkspaceDTO;
  pending: string | null;
  onSetPlanOverride: (workspaceId: string, planOverride: PlanTier | null, billingManagedByReseller: boolean) => void;
}) {
  const [planOverride, setPlanOverride] = useState<PlanTier | "">(workspace.planOverride ?? "");
  const [managed, setManaged] = useState<boolean>(workspace.billingManagedByReseller);

  const usageLabel = workspace.usage
    ? `${workspace.usage.yearMonth}: SKUs ${workspace.usage.skusUsed}, Competitors ${workspace.usage.competitorsUsed}, Seats ${workspace.usage.seatsUsed}`
    : "—";

  return (
    <tr>
      <td>{workspace.name}</td>
      <td>{workspace.plan ?? "—"}</td>
      <td>{workspace.status ?? "—"}</td>
      <td>
        <select className="switcher-select" value={planOverride} onChange={(e) => setPlanOverride(e.target.value as PlanTier | "")} disabled={!canEdit}>
          <option value="">(none)</option>
          <option value="STARTER">STARTER</option>
          <option value="PRO">PRO</option>
          <option value="AGENCY">AGENCY</option>
          <option value="ENTERPRISE">ENTERPRISE</option>
        </select>
      </td>
      <td>
        <label style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="checkbox" checked={managed} onChange={(e) => setManaged(e.target.checked)} disabled={!canEdit} />
          managed
        </label>
      </td>
      <td>{usageLabel}</td>
      <td>
        <button
          className="button-primary"
          disabled={!canEdit || pending === `override:${workspace.id}`}
          onClick={() => onSetPlanOverride(workspace.id, planOverride ? (planOverride as PlanTier) : null, managed)}
        >
          {pending === `override:${workspace.id}` ? "Saving..." : canEdit ? "Save" : "Read-only"}
        </button>
      </td>
    </tr>
  );
}
