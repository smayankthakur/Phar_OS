import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireResellerRole } from "@/lib/reseller";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace } from "@/lib/tenant";

const bodySchema = z.object({
  planOverride: z.enum(["STARTER", "PRO", "AGENCY", "ENTERPRISE"]).nullable().optional(),
  billingManagedByReseller: z.boolean().optional(),
});

export async function PATCH(request: Request, ctx: { params: Promise<{ workspaceId: string }> }) {
  try {
    await verifyCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
  }

  const membership = await requireResellerRole("RESELLER_ADMIN");
  const { workspaceId } = await ctx.params;

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid override payload", 400);
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, resellerId: membership.resellerId },
    select: { id: true },
  });
  if (!workspace) return err("NOT_FOUND", "Workspace not found", 404);

  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      planOverride: payload.planOverride === undefined ? undefined : payload.planOverride,
      billingManagedByReseller:
        payload.billingManagedByReseller === undefined ? undefined : payload.billingManagedByReseller,
    },
    select: { id: true, planOverride: true, billingManagedByReseller: true },
  });

  const { workspace: currentWorkspace } = await getCurrentWorkspace();
  await logTelemetry(prisma, currentWorkspace.id, "PLAN_OVERRIDE_SET", {
    resellerId: membership.resellerId,
    workspaceId,
    planOverride: updated.planOverride,
    billingManagedByReseller: updated.billingManagedByReseller,
  }).catch(() => undefined);

  return ok({ workspace: updated });
}
