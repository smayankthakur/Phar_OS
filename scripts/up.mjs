import { spawn } from "node:child_process";

function run(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      stdio: "inherit",
      shell: true,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${code}): ${command}`));
    });
  });
}

async function main() {
  console.log("Starting PostgreSQL...");
  await run("pnpm db:up");
  console.log("Running migrations...");
  await run("pnpm db:migrate");
  console.log("Starting web dev server...");
  await run("pnpm dev");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
