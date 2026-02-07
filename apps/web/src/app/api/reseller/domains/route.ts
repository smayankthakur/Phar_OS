import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { domainSchema, normalizeDomain, requireResellerRole } from "@/lib/reseller";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace } from "@/lib/tenant";

const bodySchema = z.object({
  domain: domainSchema,
  target: z.enum(["APP", "PORTAL"]).optional(),
});

export async function POST(request: Request) {
  const membership = await requireResellerRole("RESELLER_ADMIN");

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid domain payload", 400);
  }

  const domain = normalizeDomain(payload.domain);
  try {
    const created = await prisma.resellerDomain.create({
      data: {
        resellerId: membership.resellerId,
        domain,
        target: payload.target ?? "APP",
      },
      select: { id: true, domain: true, target: true, verifiedAt: true, createdAt: true },
    });

    const { workspace } = await getCurrentWorkspace();
    await logTelemetry(prisma, workspace.id, "DOMAIN_MAPPED", { resellerId: membership.resellerId, domain }).catch(() => undefined);

    return ok({
      domain: {
        ...created,
        verifiedAt: created.verifiedAt ? created.verifiedAt.toISOString() : null,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch {
    return err("CONFLICT", "Domain is already mapped", 409);
  }
}

