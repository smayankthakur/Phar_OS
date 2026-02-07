import { getRedis, redisConfigured } from "@/lib/redis";

type Backend = "redis" | "memory";

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

function backend(): Backend {
  const configured = (process.env.RATE_LIMIT_BACKEND ?? "redis").toLowerCase();
  if (configured === "redis" && redisConfigured()) return "redis";
  return "memory";
}

function bucketKey(windowSec: number, nowMs = Date.now()) {
  return Math.floor(nowMs / (windowSec * 1000));
}

function redisKey(input: RateLimitInput) {
  const bucket = bucketKey(input.windowSec);
  return `rl:${input.route}:${input.scopeKey}:${bucket}`;
}

const memory = new Map<string, { count: number; expiresAtMs: number }>();

async function memoryIncr(key: string, windowSec: number) {
  const now = Date.now();
  const existing = memory.get(key);
  if (!existing || existing.expiresAtMs <= now) {
    const entry = { count: 1, expiresAtMs: now + windowSec * 1000 };
    memory.set(key, entry);
    return entry.count;
  }
  existing.count += 1;
  return existing.count;
}

export async function rateLimitOrThrow(input: RateLimitInput) {
  const key = redisKey(input);
  let count = 0;

  if (backend() === "redis") {
    const redis = await getRedis();
    count = await redis.incr(key);
    if (count === 1) {
      // Best-effort TTL; key is per fixed window bucket.
      await redis.expire(key, input.windowSec);
    }
  } else {
    count = await memoryIncr(key, input.windowSec);
  }

  if (count > input.limit) {
    throw new RateLimitError("Too many requests", input.windowSec);
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

