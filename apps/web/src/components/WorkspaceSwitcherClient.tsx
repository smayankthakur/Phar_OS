"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { withCsrfHeaders } from "@/lib/csrf-client";

type WorkspaceOption = {
  id: string;
  name: string;
};

export function WorkspaceSwitcherClient({
  workspaces,
  currentWorkspaceId,
}: {
  workspaces: WorkspaceOption[];
  currentWorkspaceId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onChange = (workspaceId: string) => {
    startTransition(async () => {
      await fetch("/api/workspaces/select", {
        method: "POST",
        headers: withCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ workspaceId }),
      });

      router.refresh();
    });
  };

  return (
    <div className="switcher-form">
      <label htmlFor="workspaceId" className="switcher-label">
        Workspace
      </label>
      <select
        id="workspaceId"
        name="workspaceId"
        defaultValue={currentWorkspaceId}
        className="switcher-select"
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={pending}
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
    </div>
  );
}
