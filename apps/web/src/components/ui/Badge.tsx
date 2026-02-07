import type { ReactNode } from "react";

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "ok" | "warn" | "breach" }) {
  const className =
    tone === "ok" ? "ui-badge-ok" : tone === "warn" ? "ui-badge-warn" : tone === "breach" ? "ui-badge-breach" : "signal-badge";
  return <span className={className}>{children}</span>;
}
