"use client";

import { useEffect } from "react";

export function WorkspaceCookieSync({ workspaceId, needsSync }: { workspaceId: string; needsSync: boolean }) {
  useEffect(() => {
    if (!needsSync) return;

    void fetch("/api/workspaces/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
  }, [workspaceId, needsSync]);

  return null;
}
