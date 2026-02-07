const baseUrl = process.env.PHAROS_BASE_URL ?? "http://localhost:3000";
const endpoint = `${baseUrl.replace(/\/$/, "")}/api/demo/reset`;

async function main() {
  try {
    const response = await fetch(endpoint, { method: "POST" });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body?.error?.message ?? `HTTP ${response.status}`);
    }

    console.log(`Demo dataset reset complete for workspace ${body.workspaceId}.`);
    console.log(
      `Seeded: skus=${body.seeded?.skus ?? 0}, competitors=${body.seeded?.competitors ?? 0}, snapshots=${body.seeded?.snapshots ?? 0}, rules=${body.seeded?.rules ?? 0}`,
    );
  } catch (error) {
    console.error("Could not call /api/demo/reset.");
    console.error(
      `Run this manually while your app is running:\ncurl -X POST ${endpoint}`,
    );
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
