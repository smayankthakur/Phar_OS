import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/apiResponse";

export async function GET() {
  try {
    await prisma.workspace.count();
    return ok({
      ts: new Date().toISOString(),
      db: true,
    });
  } catch {
    return err("INTERNAL", "Database health check failed", 500);
  }
}
