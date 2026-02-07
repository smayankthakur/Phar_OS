import type { NextResponse } from "next/server";
import { err } from "@/lib/apiResponse";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { RateLimitError, rateLimitOrThrow } from "@/lib/ratelimit";

type GuardRateLimit = {
  route: string;
  scopeKey: string;
  limit: number;
  windowSec: number;
};

type GuardOptions = {
  csrf?: boolean;
  rateLimit?: GuardRateLimit;
};

type Handler<TCtx = unknown> = (request: Request, ctx: TCtx) => Promise<Response | NextResponse>;

export function withGuards<TCtx = unknown>(guards: GuardOptions, handler: Handler<TCtx>) {
  return async (request: Request, ctx: TCtx) => {
    try {
      if (guards.csrf) {
        await verifyCsrf(request);
      }
      if (guards.rateLimit) {
        await rateLimitOrThrow(guards.rateLimit);
      }
      return await handler(request, ctx);
    } catch (error) {
      if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
      if (error instanceof RateLimitError) return err("TOO_MANY_REQUESTS", error.message, 429);
      throw error;
    }
  };
}

