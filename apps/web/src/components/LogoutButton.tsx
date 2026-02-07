"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { withCsrfHeaders } from "@/lib/csrf-client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const onLogout = async () => {
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: withCsrfHeaders() });
      router.push("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <button type="button" className="button-ghost" onClick={onLogout} disabled={pending}>
      {pending ? "Signing out..." : "Logout"}
    </button>
  );
}
