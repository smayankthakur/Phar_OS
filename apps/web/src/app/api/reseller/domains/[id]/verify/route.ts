import { err, ok } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireResellerRole } from "@/lib/reseller";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace } from "@/lib/tenant";

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const membership = await requireResellerRole("RESELLER_ADMIN");
  const { id } = await ctx.params;

  const domain = await prisma.resellerDomain.findFirst({
    where: { id, resellerId: membership.resellerId },
    select: { id: true, domain: true, verifiedAt: true },
  });
  if (!domain) return err("NOT_FOUND", "Domain mapping not found", 404);

  const updated = await prisma.resellerDomain.update({
    where: { id },
    data: { verifiedAt: domain.verifiedAt ?? new Date() },
    select: { id: true, domain: true, verifiedAt: true },
  });

  const { workspace } = await getCurrentWorkspace();
  await logTelemetry(prisma, workspace.id, "DOMAIN_MAPPED", { resellerId: membership.resellerId, domain: updated.domain, verified: true }).catch(
    () => undefined,
  );

  return ok({
    domain: {
      id: updated.id,
      domain: updated.domain,
      verifiedAt: updated.verifiedAt ? updated.verifiedAt.toISOString() : null,
    },
  });
}
