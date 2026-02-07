import { CompetitorsManagerClient } from "@/components/CompetitorsManagerClient";
import { isClientDemoMode } from "@/lib/demoMode";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/tenant";

export default async function CompetitorsPage() {
  const { workspace, role } = await getCurrentWorkspace();
  const demoMode = await isClientDemoMode();

  const competitors = await prisma.competitor.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true,
      name: true,
      domain: true,
      currency: true,
    },
  });

  return <CompetitorsManagerClient items={competitors} demoMode={demoMode} ownerMode={role === "OWNER"} />;
}
