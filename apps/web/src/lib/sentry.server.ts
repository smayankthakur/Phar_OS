import { createRequire } from "node:module";

type CaptureInput = {
  requestId?: string;
  workspaceId?: string;
  userId?: string;
  route?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

function enabled() {
  return Boolean(process.env.SENTRY_DSN);
}

function tryGetSentry():
  | null
  | {
      captureException: (err: unknown, ctx?: unknown) => void;
      captureMessage: (msg: string, ctx?: unknown) => void;
    } {
  if (!enabled()) return null;
  try {
    const require = createRequire(import.meta.url);
    // Optional dependency. If it's not installed, we silently no-op.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@sentry/nextjs") as {
      captureException: (err: unknown, ctx?: unknown) => void;
      captureMessage: (msg: string, ctx?: unknown) => void;
    };
  } catch {
    return null;
  }
}

export function captureException(error: unknown, input: CaptureInput = {}) {
  const sentry = tryGetSentry();
  if (!sentry) return;
  sentry.captureException(error, {
    tags: input.tags,
    extra: {
      requestId: input.requestId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      route: input.route,
      ...(input.extra ?? {}),
    },
  });
}

export function captureMessage(message: string, input: CaptureInput = {}) {
  const sentry = tryGetSentry();
  if (!sentry) return;
  sentry.captureMessage(message, {
    tags: input.tags,
    extra: {
      requestId: input.requestId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      route: input.route,
      ...(input.extra ?? {}),
    },
  });
}

