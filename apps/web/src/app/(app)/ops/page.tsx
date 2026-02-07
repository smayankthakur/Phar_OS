import { prisma } from "@/lib/prisma";
import { getActorAndRole } from "@/lib/rbac";
import { getCurrentWorkspace } from "@/lib/tenant";
import { OpsPanelClient } from "@/components/ops/OpsPanelClient";

export default async function OpsPage() {
  const { workspace } = await getCurrentWorkspace();
  const actor = await getActorAndRole(workspace.id);

  if (actor.role !== "OWNER") {
    return (
      <main className="main-area">
        <section className="content-card">
          <h1>Background Ops</h1>
          <p>OWNER only.</p>
        </section>
      </main>
    );
  }

  const [shopifyCounts, notifyCounts] = await Promise.all([
    prisma.shopifyJob.groupBy({
      by: ["status"],
      where: { workspaceId: workspace.id },
      _count: { _all: true },
    }),
    prisma.notificationOutbox.groupBy({
      by: ["status"],
      where: { workspaceId: workspace.id },
      _count: { _all: true },
    }),
  ]);

  const shopify = Object.fromEntries(shopifyCounts.map((row) => [row.status, row._count._all]));
  const notifications = Object.fromEntries(notifyCounts.map((row) => [row.status, row._count._all]));

  return (
    <main className="main-area">
      <section className="content-card">
        <h1>Background Ops</h1>
        <p>Queue health and manual processing triggers (workspace-scoped).</p>
        <OpsPanelClient shopify={shopify} notifications={notifications} />
      </section>
    </main>
  );
}

