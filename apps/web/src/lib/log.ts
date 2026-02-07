type LogLevel = "info" | "warn" | "error";

function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => sanitize(item));

  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (lower.includes("password") || lower.includes("secret") || lower.includes("token") || lower === "authorization") {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = sanitize(raw);
  }
  return out;
}

function write(level: LogLevel, payload: Record<string, unknown>) {
  const safe = sanitize(payload) as Record<string, unknown>;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    ...safe,
  });
  // eslint-disable-next-line no-console
  console[level === "error" ? "error" : "log"](line);
}

export const log = {
  info(payload: Record<string, unknown>) {
    write("info", payload);
  },
  warn(payload: Record<string, unknown>) {
    write("warn", payload);
  },
  error(payload: Record<string, unknown>) {
    write("error", payload);
  },
};
