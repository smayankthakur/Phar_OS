import { DemoWalkthrough } from "@/components/demo/DemoWalkthrough";
import Link from "next/link";
import { getWorkspacePlan } from "@/lib/entitlements";
import { getCurrentWorkspace } from "@/lib/tenant";

export default async function DemoPage() {
  const { workspace } = await getCurrentWorkspace();
  const plan = await getWorkspacePlan(workspace.id);
  if (!plan.limits.features.demoMode) {
    return (
      <section className="content-card">
        <h2>Demo Mode Locked</h2>
        <p>Demo mode is disabled for this plan.</p>
        <Link href="/billing" className="button-primary">
          Upgrade Plan
        </Link>
      </section>
    );
  }
  return <DemoWalkthrough />;
}
