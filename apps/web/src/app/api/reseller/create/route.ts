import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { requireSessionForApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace } from "@/lib/tenant";

const bodySchema = z.object({
  name: z.string().min(3).max(80),
  brandName: z.string().min(2).max(80).optional(),
});

export async function POST(request: Request) {
  await requireSessionForApi();

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid reseller payload", 400);
  }

  const session = await requireSessionForApi();
  const existing = await prisma.resellerMembership.findFirst({
    where: { userId: session.userId },
    select: { resellerId: true },
  });
  if (existing) {
    return err("CONFLICT", "User already belongs to a reseller", 409);
  }

  const reseller = await prisma.reseller.create({
    data: {
      name: payload.name.trim(),
      brandName: payload.brandName?.trim() ?? null,
      memberships: {
        create: {
          userId: session.userId,
          role: "RESELLER_OWNER",
        },
      },
    },
    select: { id: true, name: true },
  });

  // Telemetry is workspace-scoped; log to current workspace for operational visibility.
  const { workspace } = await getCurrentWorkspace();
  await logTelemetry(prisma, workspace.id, "RESELLER_CREATED", { resellerId: reseller.id }).catch(() => undefined);

  return ok({ reseller });
}

