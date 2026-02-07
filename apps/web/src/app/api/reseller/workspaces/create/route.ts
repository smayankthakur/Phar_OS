import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireResellerRole } from "@/lib/reseller";
import { resetWorkspaceDemoDataset } from "@/lib/demoSeed";
import { logTelemetry } from "@/lib/telemetry";

const bodySchema = z.object({
  name: z.string().min(3).max(100),
  method: z.enum(["CLONE_DEMO", "EMPTY"]),
});

export async function POST(request: Request) {
  try {
    await verifyCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
  }

  const membership = await requireResellerRole("RESELLER_ADMIN");

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid workspace payload", 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: payload.name.trim(),
        resellerId: membership.resellerId,
        memberships: {
          create: {
            userId: membership.userId,
            role: "OWNER",
          },
        },
      },
      select: { id: true, name: true },
    });

    // Create default subscription record for visibility; entitlements layer also upserts if missing.
    await tx.workspaceSubscription.upsert({
      where: { workspaceId: workspace.id },
      create: { workspaceId: workspace.id, plan: "STARTER", status: "TRIALING" },
      update: {},
    });

    return workspace;
  });

  if (payload.method === "CLONE_DEMO") {
    await resetWorkspaceDemoDataset(result.id);
  }

  await logTelemetry(prisma, result.id, "CLIENT_WORKSPACE_CREATED", {
    resellerId: membership.resellerId,
    workspaceId: result.id,
    method: payload.method,
  }).catch(() => undefined);

  return ok({ workspace: result });
}
