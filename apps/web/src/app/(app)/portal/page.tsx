import { PortalTokenManager } from "@/components/portal/PortalTokenManager";
import Link from "next/link";
import { getWorkspacePlan } from "@/lib/entitlements";
import { getCurrentWorkspace } from "@/lib/tenant";

export default async function PortalManagementPage() {
  const { workspace } = await getCurrentWorkspace();
  const plan = await getWorkspacePlan(workspace.id);
  if (!plan.limits.features.portal) {
    return (
      <section className="content-card">
        <h2>Portal Locked</h2>
        <p>Your current plan does not include Client Portal.</p>
        <Link href="/billing" className="button-primary">
          Upgrade Plan
        </Link>
      </section>
    );
  }
  return <PortalTokenManager />;
}
