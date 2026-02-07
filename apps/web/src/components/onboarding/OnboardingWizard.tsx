"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { withCsrfHeaders } from "@/lib/csrf-client";

type WorkspaceOption = {
  id: string;
  name: string;
};

type StartMethod = "clone" | "empty";

export function OnboardingWizard({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const router = useRouter();
  const [startMethod, setStartMethod] = useState<StartMethod>("clone");
  const defaultSourceId = useMemo(() => {
    const demo = workspaces.find((item) => item.name.toLowerCase().includes("demo"));
    return demo?.id ?? workspaces[0]?.id ?? "";
  }, [workspaces]);
  const [sourceWorkspaceId, setSourceWorkspaceId] = useState(defaultSourceId);
  const [workspaceName, setWorkspaceName] = useState(`Client Pilot - ${new Date().toISOString().slice(0, 10)}`);
  const [includeSkus, setIncludeSkus] = useState(false);
  const [includeCompetitors, setIncludeCompetitors] = useState(false);
  const [includeSnapshots, setIncludeSnapshots] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = workspaceName.trim().length >= 3 && (startMethod === "empty" || sourceWorkspaceId.length > 0);

  const onCreate = async () => {
    if (!canCreate) return;
    setPending(true);
    setError(null);

    try {
      let newWorkspaceId = "";

      if (startMethod === "clone") {
        const response = await fetch("/api/workspaces/clone", {
          method: "POST",
          headers: withCsrfHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            sourceWorkspaceId,
            newWorkspaceName: workspaceName.trim(),
            includeData: {
              skus: includeSkus,
              competitors: includeCompetitors,
              snapshots: includeSnapshots,
            },
            setAsCurrent: true,
            exitClientDemoMode: true,
          }),
        });

        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body?.error?.message ?? "Workspace clone failed");
        }
        newWorkspaceId = body.newWorkspaceId;
      } else {
        const createResponse = await fetch("/api/workspaces", {
          method: "POST",
          headers: withCsrfHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ name: workspaceName.trim() }),
        });
        const createBody = await createResponse.json().catch(() => ({}));
        if (!createResponse.ok) {
          throw new Error(createBody?.error?.message ?? "Workspace creation failed");
        }
        newWorkspaceId = createBody?.item?.id;
        if (!newWorkspaceId) {
          throw new Error("Workspace created without id");
        }

        await fetch("/api/workspaces/select", {
          method: "POST",
          headers: withCsrfHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ workspaceId: newWorkspaceId }),
        });
        await fetch("/api/demo/exit", { method: "POST", headers: withCsrfHeaders() });
      }

      router.push(`/import?onboarded=1&workspaceId=${newWorkspaceId}`);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Onboarding failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="detail-grid">
      <section className="content-card">
        <h2>Client Onboarding Wizard</h2>
        <p>Set up a pilot workspace with the right starter data in a single guided flow.</p>
      </section>

      {error ? <Toast tone="error" message={error} /> : null}

      <section className="content-card">
        <h3>Step 1: Choose Start Method</h3>
        <div className="row-actions">
          <Button variant={startMethod === "clone" ? "primary" : "secondary"} onClick={() => setStartMethod("clone")}>
            Clone PharOS Demo (recommended)
          </Button>
          <Button variant={startMethod === "empty" ? "primary" : "secondary"} onClick={() => setStartMethod("empty")}>
            Start Empty
          </Button>
        </div>
      </section>

      {startMethod === "clone" ? (
        <section className="content-card">
          <h3>Step 2: Choose Source Workspace</h3>
          <label className="field">
            <span>Source workspace</span>
            <select value={sourceWorkspaceId} onChange={(event) => setSourceWorkspaceId(event.target.value)}>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      <section className="content-card">
        <h3>Step 3: Name Workspace</h3>
        <label className="field">
          <span>Workspace name</span>
          <input
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            placeholder="BabyDoc Pilot - Feb 2026"
            minLength={3}
          />
        </label>
      </section>

      {startMethod === "clone" ? (
        <section className="content-card">
          <h3>Step 4: Data Toggles</h3>
          <p className="metric-note">Default OFF for real clients. Enable ON for internal demo clones.</p>
          <label className="field check-field">
            <input type="checkbox" checked={includeSkus} onChange={(event) => setIncludeSkus(event.target.checked)} />
            <span>Include SKUs</span>
          </label>
          <label className="field check-field">
            <input
              type="checkbox"
              checked={includeCompetitors}
              onChange={(event) => setIncludeCompetitors(event.target.checked)}
            />
            <span>Include Competitors</span>
          </label>
          <label className="field check-field">
            <input
              type="checkbox"
              checked={includeSnapshots}
              onChange={(event) => setIncludeSnapshots(event.target.checked)}
            />
            <span>Include Snapshots (requires SKUs + Competitors)</span>
          </label>
        </section>
      ) : null}

      <section className="content-card">
        <h3>Step 5: Create and Continue</h3>
        <div className="row-actions">
          <Button onClick={onCreate} loading={pending} loadingText="Creating..." disabled={!canCreate}>
            Create Workspace
          </Button>
        </div>
        <p className="metric-note">After creation you will be redirected to Import Center.</p>
      </section>
    </div>
  );
}
