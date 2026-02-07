import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ResellerDashboardClient } from "@/components/reseller/ResellerDashboardClient";

export default async function ResellerPage() {
  const session = await requireSession();

  const membership = await prisma.resellerMembership.findFirst({
    where: { userId: session.userId },
    select: { resellerId: true, role: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    return (
      <section className="content-card">
        <h1>Reseller Dashboard</h1>
        <p>Create a reseller account to manage client workspaces, branding, and plan overrides.</p>
        <ResellerDashboardClient mode="create" />
      </section>
    );
  }

  const [reseller, domains, workspaces] = await Promise.all([
    prisma.reseller.findUnique({
      where: { id: membership.resellerId },
      select: {
        id: true,
        name: true,
        brandName: true,
        appName: true,
        logoUrl: true,
        accentColor: true,
        supportEmail: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
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
        subscription: { select: { plan: true, status: true } },
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

  return (
    <section className="content-card">
      <h1>Reseller Dashboard</h1>
      <p>Manage clients, branding, and domain mappings.</p>
      <ResellerDashboardClient
        mode="dashboard"
        role={membership.role as "RESELLER_OWNER" | "RESELLER_ADMIN" | "RESELLER_SUPPORT"}
        reseller={
          reseller
            ? {
                ...reseller,
                createdAt: reseller.createdAt.toISOString(),
                updatedAt: reseller.updatedAt.toISOString(),
              }
            : null
        }
        domains={domains.map((d) => ({
          ...d,
          verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
          createdAt: d.createdAt.toISOString(),
        }))}
        workspaces={workspaces.map((w) => ({
          id: w.id,
          name: w.name,
          createdAt: w.createdAt.toISOString(),
          plan: w.subscription?.plan ?? null,
          status: w.subscription?.status ?? null,
          planOverride: w.planOverride ?? null,
          billingManagedByReseller: w.billingManagedByReseller,
          usage: w.usageMonths[0] ?? null,
        }))}
      />
    </section>
  );
}

