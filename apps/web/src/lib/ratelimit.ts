import { redisConfigured, redisIncrWithTTL } from "@/lib/redis";

type RateLimitInput = {
  route: string;
  scopeKey: string;
  limit: number;
  windowSec: number;
};

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfterSec: number,
  ) {
    super(message);
  }
}

function windowStartSec(windowSec: number, nowSec = Math.floor(Date.now() / 1000)) {
  return Math.floor(nowSec / windowSec) * windowSec;
}

function redisKey(input: RateLimitInput, nowSec = Math.floor(Date.now() / 1000)) {
  const windowStart = windowStartSec(input.windowSec, nowSec);
  return { key: `rl:${input.route}:${input.scopeKey}:${windowStart}`, windowStart };
}

export async function rateLimitOrThrow(input: RateLimitInput) {
  if (!redisConfigured()) {
    throw new Error("Redis is required for rate limiting (missing REDIS_URL or UPSTASH config).");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const { key, windowStart } = redisKey(input, nowSec);
  const count = await redisIncrWithTTL(key, input.windowSec);

  if (count > input.limit) {
    const retryAfter = Math.max(1, input.windowSec - (nowSec - windowStart));
    throw new RateLimitError("Too many requests", retryAfter);
  }
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
