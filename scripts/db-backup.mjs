import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function runPgDump(outPath, databaseUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pg_dump",
      [
        "--no-owner",
        "--no-privileges",
        "--format=plain",
        `--file=${outPath}`,
        `--dbname=${databaseUrl}`,
      ],
      { stdio: "inherit", env: process.env },
    );
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump failed (exit ${code})`));
    });
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const dir = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.resolve("backups");
  mkdirSync(dir, { recursive: true });

  const outPath = path.join(dir, `pharos-${timestamp()}.sql`);
  await runPgDump(outPath, databaseUrl);

  console.log(`[db:backup] Wrote ${outPath}`);
}

main().catch((error) => {
  console.error(`[db:backup] ${error.message}`);
  process.exit(1);
});

