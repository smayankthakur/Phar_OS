import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireResellerRole } from "@/lib/reseller";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace } from "@/lib/tenant";

const bodySchema = z.object({
  brandName: z.string().min(2).max(80).nullable().optional(),
  appName: z.string().min(2).max(80).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  accentColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/)
    .nullable()
    .optional(),
  supportEmail: z.string().email().nullable().optional(),
});

export async function PATCH(request: Request) {
  const membership = await requireResellerRole("RESELLER_ADMIN");

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid branding payload", 400);
  }

  const updated = await prisma.reseller.update({
    where: { id: membership.resellerId },
    data: {
      brandName: payload.brandName ?? undefined,
      appName: payload.appName ?? undefined,
      logoUrl: payload.logoUrl ?? undefined,
      accentColor: payload.accentColor ?? undefined,
      supportEmail: payload.supportEmail ?? undefined,
    },
    select: {
      id: true,
      name: true,
      brandName: true,
      appName: true,
      logoUrl: true,
      accentColor: true,
      supportEmail: true,
    },
  });

  const { workspace } = await getCurrentWorkspace();
  await logTelemetry(prisma, workspace.id, "BRANDING_UPDATED", { resellerId: membership.resellerId }).catch(() => undefined);

  return ok({ reseller: updated });
}

