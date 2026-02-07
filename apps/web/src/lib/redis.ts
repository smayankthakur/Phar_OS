import { createClient } from "redis";

type Client = ReturnType<typeof createClient>;

let client: Client | null = null;
let connectPromise: Promise<Client> | null = null;

export function redisConfigured() {
  return Boolean(process.env.REDIS_URL);
}

export async function getRedis(): Promise<Client> {
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
