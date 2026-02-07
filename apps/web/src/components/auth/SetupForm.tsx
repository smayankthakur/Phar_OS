"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function SetupForm() {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("PharOS Workspace");
  const [email, setEmail] = useState("admin@pharos.local");
  const [password, setPassword] = useState("admin123!");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceName, email, password }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "Setup failed");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Setup failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="sku-form" onSubmit={onSubmit}>
      <label className="field">
        <span>Workspace Name</span>
        <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} minLength={3} required />
      </label>
      <label className="field">
        <span>Owner Email</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button-primary" type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create owner account"}
      </button>
    </form>
  );
}
