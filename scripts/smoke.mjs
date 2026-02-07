import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

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

async function requestJson(baseUrl, path, options = {}, cookieJar, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
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

  console.log("[smoke] Running migrations...");
  await run("pnpm db:migrate", baseEnv);
  console.log("[smoke] Building web app...");
  await run("pnpm --filter web build", baseEnv);

  console.log(`[smoke] Starting server at ${baseUrl} ...`);
  const server = spawn(`pnpm --filter web exec dotenv -e ../../.env -- next start -p ${port}`, {
    shell: true,
    stdio: "inherit",
    env: baseEnv,
  });
  let serverExited = false;
  server.on("exit", () => {
    serverExited = true;
  });

  try {
    const healthy = await waitFor(`${baseUrl}/api/health`, 45000);
    if (!healthy) {
      if (serverExited) {
        throw new Error("Server exited before health check completed");
      }
      throw new Error("Server did not become healthy in time");
    }
    console.log("[smoke] Health check passed.");

    console.log("[smoke] Ensuring auth session...");
    await ensureAuth(baseUrl, cookieJar);

    console.log("[smoke] Verifying cron secret enforcement...");
    await assertCronSecret(baseUrl, baseEnv.CRON_SECRET);

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

    console.log("[smoke] Smoke tests passed.");
  } finally {
    if (!serverExited) {
      server.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error(`Smoke tests failed: ${error.message}`);
  process.exit(1);
});
