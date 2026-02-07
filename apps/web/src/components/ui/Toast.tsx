export function Toast({ message, tone = "ok" }: { message: string; tone?: "ok" | "error" }) {
  return <div className={`ui-toast ${tone === "error" ? "ui-toast-error" : "ui-toast-ok"}`}>{message}</div>;
}
