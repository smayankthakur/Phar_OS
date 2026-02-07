"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function LoadDemoDatasetButton({ label = "Load Demo Dataset" }: { label?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/reset", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to load demo dataset");
      }
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load demo dataset");
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <Button variant="secondary" onClick={onClick} loading={pending} loadingText="Loading...">
        {label}
      </Button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
