"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { withCsrfHeaders } from "@/lib/csrf-client";

export function ClientDemoEnterButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enterDemo = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/create-workspace", { method: "POST", headers: withCsrfHeaders() });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login?next=/client-demo");
          return;
        }
        throw new Error(body?.error?.message ?? "Failed to enter demo");
      }
      router.push("/demo");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to enter demo");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="detail-grid">
      <Button onClick={enterDemo} loading={pending} loadingText="Preparing Demo Workspace...">
        Enter Demo
      </Button>
      {error ? <Toast message={error} tone="error" /> : null}
    </div>
  );
}
