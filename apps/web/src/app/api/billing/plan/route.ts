import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { PLAN_DEFS, PLAN_TIERS, type PlanTier } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/rbac";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace } from "@/lib/tenant";

const schema = z.object({
  plan: z.enum(PLAN_TIERS as [PlanTier, ...PlanTier[]]),
});

export async function PATCH(request: Request) {
  if (process.env.ALLOW_MANUAL_PLAN_CHANGE !== "1") {
    return err("FORBIDDEN", "Manual plan change disabled. Use Stripe checkout.", 403);
  }
  const { workspace } = await getCurrentWorkspace();

  let actor;
  try {
    actor = await requireOwner(workspace.id);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize plan change", 500);
  }

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid billing payload", 400);
  }

  const existing = await prisma.workspaceSubscription.upsert({
    where: { workspaceId: workspace.id },
    create: {
      workspaceId: workspace.id,
      plan: payload.plan,
    },
    update: {
      plan: payload.plan,
      status: "ACTIVE",
      renewedAt: new Date(),
    },
  });

  await logTelemetry(prisma, workspace.id, "PLAN_CHANGED", {
    plan: payload.plan,
    actorUserId: actor.userId,
  });

  return ok({
    subscription: {
      plan: existing.plan,
      status: existing.status,
      limits: PLAN_DEFS[existing.plan as PlanTier],
    },
  });
}
