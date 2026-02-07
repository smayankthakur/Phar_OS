"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { withCsrfHeaders } from "@/lib/csrf-client";

export function ApplyActionButton({
  actionId,
  disabled = false,
  disabledLabel = "Blocked",
}: {
  actionId: string;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyAction = async () => {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/actions/${actionId}/apply`, {
        method: "POST",
        headers: withCsrfHeaders(),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Apply failed");
      }

      router.refresh();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Apply failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <button type="button" className="button-secondary" onClick={applyAction} disabled={pending || disabled}>
        {pending ? "Applying..." : disabled ? disabledLabel : "Apply"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
