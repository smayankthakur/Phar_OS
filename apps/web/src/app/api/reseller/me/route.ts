import { ok } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { getResellerMembershipForCurrentUser } from "@/lib/reseller";

export async function GET() {
  const membership = await getResellerMembershipForCurrentUser();
  if (!membership) {
    return ok({ reseller: null });
  }

  const [domains, workspaces] = await Promise.all([
    prisma.resellerDomain.findMany({
      where: { resellerId: membership.resellerId },
      orderBy: { createdAt: "asc" },
      select: { id: true, domain: true, target: true, verifiedAt: true, createdAt: true },
    }),
    prisma.workspace.findMany({
      where: { resellerId: membership.resellerId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        planOverride: true,
        billingManagedByReseller: true,
        subscription: {
          select: { plan: true, status: true },
        },
        usageMonths: {
          orderBy: { yearMonth: "desc" },
          take: 1,
          select: {
            yearMonth: true,
            seatsUsed: true,
            skusUsed: true,
            competitorsUsed: true,
            snapshotImportRowsUsed: true,
            portalTokensUsed: true,
          },
        },
      },
    }),
  ]);

  return ok({
    reseller: {
      ...membership.reseller,
      role: membership.role,
    },
    domains: domains.map((d) => ({
      ...d,
      verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
    })),
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      createdAt: w.createdAt.toISOString(),
      plan: w.subscription?.plan ?? null,
      status: w.subscription?.status ?? null,
      planOverride: w.planOverride ?? null,
      billingManagedByReseller: w.billingManagedByReseller,
      usage: w.usageMonths[0] ?? null,
    })),
  });
}

