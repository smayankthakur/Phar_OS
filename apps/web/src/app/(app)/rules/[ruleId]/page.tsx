import { notFound } from "next/navigation";
import { RuleEditor } from "@/components/RuleEditor";
import { isClientDemoMode } from "@/lib/demoMode";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/tenant";

export default async function RuleDetailPage({ params }: { params: Promise<{ ruleId: string }> }) {
  const { workspace, role } = await getCurrentWorkspace();
  const demoMode = await isClientDemoMode();
  const { ruleId } = await params;

  const rule = await prisma.rule.findFirst({
    where: {
      id: ruleId,
      workspaceId: workspace.id,
    },
  });

  if (!rule) {
    notFound();
  }

  return (
    <RuleEditor
      mode="edit"
      ruleId={rule.id}
      initial={{
        name: rule.name,
        eventType: rule.eventType as "COMPETITOR_PRICE_DROP" | "COST_INCREASE" | "STOCK_LOW",
        enabled: rule.enabled,
        condition: rule.condition as Record<string, unknown>,
        actionTemplate: rule.actionTemplate as {
          type: "PRICE_MATCH" | "PRICE_INCREASE" | "NOTIFY";
          params: Record<string, unknown>;
        },
      }}
      demoMode={demoMode}
      ownerMode={role === "OWNER"}
    />
  );
}
