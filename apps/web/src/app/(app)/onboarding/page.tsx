import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/tenant";

export default async function OnboardingPage() {
  await getCurrentWorkspace();

  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return <OnboardingWizard workspaces={workspaces} />;
}
