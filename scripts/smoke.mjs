import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, "utf8");
    const map = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      map[key] = value;
    }
    return map;
  } catch {
    return {};
  }
}

function run(command, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, stdio: "inherit", env });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${code}): ${command}`));
    });
  });
}

async function waitFor(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function startServer(port, env) {
  const baseUrl = `http://localhost:${port}`;
  const server = spawn(`pnpm --filter web exec dotenv -e ../../.env -- next start -p ${port}`, {
    shell: true,
    stdio: "inherit",
    env,
  });
  let serverExited = false;
  server.on("exit", () => {
    serverExited = true;
  });
  return {
    baseUrl,
    server,
    get exited() {
      return serverExited;
    },
    stop() {
      if (!serverExited) {
        server.kill("SIGTERM");
      }
    },
  };
}

function extractSetCookies(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function updateCookieJar(cookieJar, response) {
  const setCookies = extractSetCookies(response);
  for (const line of setCookies) {
    const firstPart = line.split(";")[0];
    const idx = firstPart.indexOf("=");
    if (idx <= 0) continue;
    const name = firstPart.slice(0, idx).trim();
    const value = firstPart.slice(idx + 1).trim();
    cookieJar[name] = value;
  }
}

function toCookieHeader(cookieJar) {
  const entries = Object.entries(cookieJar).filter(([, value]) => value !== "");
  return entries.map(([key, value]) => `${key}=${value}`).join("; ");
}

function isMutatingMethod(method) {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

async function requestJson(baseUrl, path, options = {}, cookieJar, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const method = (options.method ?? "GET").toUpperCase();
  const csrf = cookieJar?.pharos_csrf;
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
      ...(cookieJar && csrf && isMutatingMethod(method) ? { "x-pharos-csrf": csrf } : {}),
      ...(cookieJar && Object.keys(cookieJar).length > 0 ? { Cookie: toCookieHeader(cookieJar) } : {}),
    },
  }).finally(() => clearTimeout(timer));

  updateCookieJar(cookieJar, response);

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed: ${body?.error?.message ?? response.statusText}`);
  }
  return body;
}

async function ensureAuth(baseUrl, cookieJar) {
  const email = process.env.SMOKE_EMAIL ?? "admin@pharos.local";
  const password = process.env.SMOKE_PASSWORD ?? "admin123!";

  const setupPayload = {
    workspaceName: `Smoke Workspace ${Date.now()}`,
    email,
    password,
  };

  const setupResponse = await fetch(`${baseUrl}/api/auth/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(setupPayload),
  });
  updateCookieJar(cookieJar, setupResponse);

  if (setupResponse.ok) return;

  if (setupResponse.status !== 409) {
    const body = await setupResponse.json().catch(() => ({}));
    throw new Error(`/api/auth/setup failed: ${body?.error?.message ?? setupResponse.statusText}`);
  }

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  updateCookieJar(cookieJar, loginResponse);

  if (!loginResponse.ok) {
    const body = await loginResponse.json().catch(() => ({}));
    throw new Error(`/api/auth/login failed: ${body?.error?.message ?? loginResponse.statusText}`);
  }
}

async function assertCronSecret(baseUrl, cronSecret) {
  const noSecret = await fetch(`${baseUrl}/api/cron/recalc-usage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (noSecret.status !== 401) {
    throw new Error(`Cron endpoint without secret should be 401, got ${noSecret.status}`);
  }

  const withSecret = await fetch(`${baseUrl}/api/cron/recalc-usage`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Pharos-Cron": cronSecret },
    body: "{}",
  });
  if (!withSecret.ok) {
    const body = await withSecret.json().catch(() => ({}));
    throw new Error(`Cron endpoint with secret should succeed: ${body?.error?.message ?? withSecret.statusText}`);
  }
}

async function assertCronEndpoints(baseUrl, cronSecret) {
  const endpoints = ["/api/cron/process-shopify", "/api/cron/process-notifications", "/api/cron/recalc-usage"];
  for (const path of endpoints) {
    const noSecret = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (noSecret.status !== 401) {
      throw new Error(`${path} without secret should be 401, got ${noSecret.status}`);
    }
  }

  for (const path of endpoints) {
    const withSecret = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Pharos-Cron": cronSecret },
      body: "{}",
    });
    if (!withSecret.ok) {
      const body = await withSecret.json().catch(() => ({}));
      throw new Error(`${path} with secret should succeed: ${body?.error?.message ?? withSecret.statusText}`);
    }
  }
}

async function assertLoginRateLimit(baseUrl, email, wrongPassword) {
  let lastStatus = 0;
  for (let i = 0; i < 12; i += 1) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: wrongPassword }),
    });
    lastStatus = res.status;
    if (res.status === 429) return true;
  }
  throw new Error(`Expected login endpoint to rate limit (429). Last status: ${lastStatus}`);
}

async function assertCsrfEnforced(baseUrl, cookieJar) {
  // Logout is a safe mutating route to assert CSRF enforcement without changing DB state.
  const res = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieJar && Object.keys(cookieJar).length > 0 ? { Cookie: toCookieHeader(cookieJar) } : {}),
    },
  });
  if (res.status !== 403) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Expected CSRF-protected endpoint to return 403 without header. Got ${res.status}: ${body?.error?.message ?? ""}`);
  }
}

async function assertStripeWebhookCsrfExempt(baseUrl) {
  const res = await fetch(`${baseUrl}/api/stripe/webhook`, { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
  if (res.status === 403) {
    throw new Error("Stripe webhook should be CSRF-exempt (should not return 403)");
  }
}

async function assertLoginRateLimitPersists(baseEnv, port, email, wrongPassword) {
  const runner = startServer(port, baseEnv);
  try {
    const healthy = await waitFor(`${runner.baseUrl}/api/health`, 45000);
    if (!healthy) throw new Error("Restarted server did not become healthy");
    await assertLoginRateLimit(runner.baseUrl, email, wrongPassword);
  } finally {
    runner.stop();
  }
}

async function seedOpsQueues(prisma, workspaceId) {
  await prisma.workspaceNotificationSettings.upsert({
    where: { workspaceId },
    create: { workspaceId, notifyMode: "DRY_RUN" },
    update: { notifyMode: "DRY_RUN" },
  });

  const sku = await prisma.sKU.create({
    data: {
      workspaceId,
      title: `Smoke Shopify SKU ${Date.now()}`,
      sku: `SMOKE-SHOPIFY-${Date.now()}`,
      cost: 100,
      currentPrice: 120,
      status: "ACTIVE",
      shopifyProductId: "gid://shopify/Product/1",
      shopifyVariantId: "gid://shopify/ProductVariant/1",
    },
    select: { id: true, shopifyVariantId: true },
  });

  const shopifyJobs = await prisma.shopifyJob.createMany({
    data: [
      {
        workspaceId,
        skuId: sku.id,
        type: "UPDATE_VARIANT_PRICE",
        payload: { variantId: sku.shopifyVariantId, newPrice: 123.45 },
        status: "QUEUED",
      },
      {
        workspaceId,
        skuId: sku.id,
        type: "UPDATE_VARIANT_PRICE",
        payload: { variantId: sku.shopifyVariantId, newPrice: 125.0 },
        status: "QUEUED",
      },
    ],
  });

  const outbox = await prisma.notificationOutbox.createMany({
    data: [
      {
        workspaceId,
        type: "EMAIL",
        payload: {
          recipients: ["ops@pharos.local"],
          subject: "Smoke test notification",
          text: "Smoke test body",
          json: { hello: "world" },
        },
        status: "QUEUED",
      },
      {
        workspaceId,
        type: "WEBHOOK",
        payload: {
          url: "https://example.com/webhook",
          body: { hello: "webhook" },
        },
        status: "QUEUED",
      },
    ],
  });

  const shopifyIds = await prisma.shopifyJob.findMany({
    where: { workspaceId, status: "QUEUED" },
    orderBy: { createdAt: "desc" },
    take: 2,
    select: { id: true },
  });
  const outboxIds = await prisma.notificationOutbox.findMany({
    where: { workspaceId, status: "QUEUED" },
    orderBy: { createdAt: "desc" },
    take: 2,
    select: { id: true },
  });

  return {
    shopifyJobIds: shopifyIds.map((row) => row.id),
    outboxIds: outboxIds.map((row) => row.id),
    shopifyCount: shopifyJobs.count,
    outboxCount: outbox.count,
  };
}

async function assertClaimingNoDoubleProcess(prisma, baseUrl, cookieJar, workspaceId) {
  const seeded = await seedOpsQueues(prisma, workspaceId);
  if (seeded.shopifyCount === 0 || seeded.outboxCount === 0) {
    throw new Error("Failed to seed ops queues for claiming test");
  }

  await Promise.all([
    requestJson(baseUrl, "/api/ops/process-shopify", { method: "POST", body: JSON.stringify({ limit: 2 }) }, cookieJar),
    requestJson(baseUrl, "/api/ops/process-shopify", { method: "POST", body: JSON.stringify({ limit: 2 }) }, cookieJar),
    requestJson(baseUrl, "/api/ops/process-notifications", { method: "POST", body: JSON.stringify({ limit: 2 }) }, cookieJar),
    requestJson(baseUrl, "/api/ops/process-notifications", { method: "POST", body: JSON.stringify({ limit: 2 }) }, cookieJar),
  ]);

  const jobs = await prisma.shopifyJob.findMany({
    where: { id: { in: seeded.shopifyJobIds } },
    select: { id: true, status: true, attempts: true },
  });
  const outbox = await prisma.notificationOutbox.findMany({
    where: { id: { in: seeded.outboxIds } },
    select: { id: true, status: true, attempts: true },
  });

  const badJob = jobs.find((job) => job.status === "RUNNING" || job.attempts > 1);
  if (badJob) {
    throw new Error(`Shopify claiming failed: job ${badJob.id} status=${badJob.status} attempts=${badJob.attempts}`);
  }

  const badOutbox = outbox.find((item) => item.status === "RUNNING" || item.attempts > 1);
  if (badOutbox) {
    throw new Error(`Outbox claiming failed: item ${badOutbox.id} status=${badOutbox.status} attempts=${badOutbox.attempts}`);
  }
}

async function main() {
  const envFile = loadEnvFile(".env");
  const baseEnv = { ...envFile, ...process.env };
  if (baseEnv.DATABASE_URL_SMOKE) {
    baseEnv.DATABASE_URL = baseEnv.DATABASE_URL_SMOKE;
  }
  if (!baseEnv.CRON_SECRET) {
    baseEnv.CRON_SECRET = `smoke-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  const port = 3400 + Math.floor(Math.random() * 300);
  const baseUrl = `http://localhost:${port}`;
  const cookieJar = {};
  const prisma = new PrismaClient({
    datasourceUrl: baseEnv.DATABASE_URL,
  });

  console.log("[smoke] Running migrations...");
  await run("pnpm db:migrate", baseEnv);
  console.log("[smoke] Building web app...");
  await run("pnpm --filter web build", baseEnv);

  console.log(`[smoke] Starting server at ${baseUrl} ...`);
  const runner = startServer(port, baseEnv);

  try {
    const healthy = await waitFor(`${baseUrl}/api/health`, 45000);
    if (!healthy) {
      if (runner.exited) {
        throw new Error("Server exited before health check completed");
      }
      throw new Error("Server did not become healthy in time");
    }
    console.log("[smoke] Health check passed.");

    console.log("[smoke] Ensuring auth session...");
    await ensureAuth(baseUrl, cookieJar);

    console.log("[smoke] Verifying cron secret enforcement...");
    await assertCronSecret(baseUrl, baseEnv.CRON_SECRET);
    await assertCronEndpoints(baseUrl, baseEnv.CRON_SECRET);

    console.log("[smoke] Verifying CSRF enforcement...");
    await assertCsrfEnforced(baseUrl, cookieJar);

    console.log("[smoke] Verifying Stripe webhook is CSRF-exempt...");
    await assertStripeWebhookCsrfExempt(baseUrl);

    console.log("[smoke] Verifying login rate limiting...");
    await assertLoginRateLimit(baseUrl, "rate-limit@pharos.local", "wrong-password-123!");

    console.log("[smoke] Creating isolated demo workspace...");
    const created = await requestJson(baseUrl, "/api/demo/create-workspace", { method: "POST" }, cookieJar);
    const workspaceId = created.workspaceId;
    if (!workspaceId) throw new Error("Missing workspaceId from demo workspace creation");

    console.log("[smoke] Resetting workspace demo dataset...");
    await requestJson(baseUrl, "/api/demo/reset", { method: "POST" }, cookieJar);

    console.log("[smoke] Running simulation...");
    await requestJson(
      baseUrl,
      "/api/demo/simulate",
      {
        method: "POST",
        body: JSON.stringify({ type: "COMPETITOR_PRICE_DROP" }),
      },
      cookieJar,
    );

    console.log("[smoke] Loading recommended action...");
    const recommended = await requestJson(baseUrl, "/api/actions?status=RECOMMENDED&limit=1", { method: "GET" }, cookieJar);
    const action = recommended?.items?.[0];
    if (!action?.id || !action?.sku?.id) throw new Error("No recommended action found after simulation");

    console.log("[smoke] Reading SKU before apply...");
    const skuBefore = await requestJson(baseUrl, `/api/skus/${action.sku.id}`, { method: "GET" }, cookieJar);
    const beforePrice = Number(skuBefore?.item?.currentPrice);

    console.log("[smoke] Applying recommendation...");
    await requestJson(baseUrl, `/api/actions/${action.id}/apply`, { method: "POST" }, cookieJar);

    console.log("[smoke] Verifying SKU changed...");
    const skuAfter = await requestJson(baseUrl, `/api/skus/${action.sku.id}`, { method: "GET" }, cookieJar);
    const afterPrice = Number(skuAfter?.item?.currentPrice);
    if (!Number.isFinite(beforePrice) || !Number.isFinite(afterPrice) || beforePrice === afterPrice) {
      throw new Error("SKU price did not change after apply");
    }

    console.log("[smoke] Verifying timeline merged entries...");
    const timeline = await requestJson(baseUrl, `/api/skus/${action.sku.id}/timeline`, { method: "GET" }, cookieJar);
    const kinds = new Set((timeline?.items ?? []).map((item) => item.kind));
    if (!kinds.has("EVENT") || !kinds.has("ACTION") || !kinds.has("AUDIT")) {
      throw new Error("Timeline is missing EVENT/ACTION/AUDIT entries");
    }

    console.log("[smoke] Verifying durable claiming with concurrent ops...");
    await assertClaimingNoDoubleProcess(prisma, baseUrl, cookieJar, workspaceId);

    if ((baseEnv.RATE_LIMIT_BACKEND ?? "redis").toLowerCase() === "redis" && (baseEnv.REDIS_URL || baseEnv.UPSTASH_REDIS_REST_URL)) {
      console.log("[smoke] Verifying Redis rate limit persists across restart...");
      runner.stop();
      await assertLoginRateLimitPersists(baseEnv, port, "rate-limit@pharos.local", "wrong-password-123!");
    }

    console.log("[smoke] Smoke tests passed.");
  } finally {
    runner.stop();
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`Smoke tests failed: ${error.message}`);
  process.exit(1);
});
