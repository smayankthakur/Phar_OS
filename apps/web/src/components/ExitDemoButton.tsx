"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { withCsrfHeaders } from "@/lib/csrf-client";

export function ExitDemoButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const onExit = async () => {
    setPending(true);
    try {
      await fetch("/api/demo/exit", { method: "POST", headers: withCsrfHeaders() });
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <button type="button" className="button-ghost" onClick={onExit} disabled={pending}>
      {pending ? "Exiting..." : "Exit demo"}
    </button>
  );
}
