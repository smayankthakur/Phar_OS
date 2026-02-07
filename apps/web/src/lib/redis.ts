import { createClient } from "redis";

type Client = ReturnType<typeof createClient>;
type UpstashCommand = Array<string | number>;

let client: Client | null = null;
let connectPromise: Promise<Client> | null = null;

function upstashConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function redisUrlConfigured() {
  return Boolean(process.env.REDIS_URL);
}

export function redisConfigured() {
  return upstashConfigured() || redisUrlConfigured();
}

async function getRedis(): Promise<Client> {
  if (client) return client;
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not configured");
  }

  if (!connectPromise) {
    const created = createClient({ url: process.env.REDIS_URL });
    connectPromise = created.connect().then(() => {
      client = created;
      return created;
    });
  }

  return connectPromise;
}

async function upstashRequest(commands: UpstashCommand[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upstash request failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return response.json() as Promise<Array<{ result: unknown; error?: string }>>;
}

async function upstashSingle<T>(command: UpstashCommand): Promise<T | null> {
  const results = await upstashRequest([command]);
  const [first] = results;
  if (!first) return null;
  if (first.error) {
    throw new Error(first.error);
  }
  return first.result as T;
}

export async function redisIncrWithTTL(key: string, ttlSeconds: number) {
  if (!redisConfigured()) throw new Error("Redis is not configured");
  if (upstashConfigured()) {
    const count = await upstashSingle<number>(["INCR", key]);
    if (count === 1) {
      await upstashSingle<number>(["EXPIRE", key, ttlSeconds]);
    }
    return count ?? 0;
  }

  const redis = await getRedis();
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }
  return count;
}

export async function redisGet(key: string) {
  if (!redisConfigured()) throw new Error("Redis is not configured");
  if (upstashConfigured()) {
    return upstashSingle<string | null>(["GET", key]);
  }
  const redis = await getRedis();
  return redis.get(key);
}

export async function redisSet(key: string, value: string, ttlSeconds?: number) {
  if (!redisConfigured()) throw new Error("Redis is not configured");
  if (upstashConfigured()) {
    if (ttlSeconds) {
      await upstashRequest([
        ["SET", key, value],
        ["EXPIRE", key, ttlSeconds],
      ]);
      return;
    }
    await upstashSingle<unknown>(["SET", key, value]);
    return;
  }

  const redis = await getRedis();
  if (ttlSeconds) {
    await redis.set(key, value, { EX: ttlSeconds });
    return;
  }
  await redis.set(key, value);
}
