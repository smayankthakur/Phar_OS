import { NotificationsIntegrationPanel } from "@/components/integrations/NotificationsIntegrationPanel";
import Link from "next/link";
import { getWorkspacePlan } from "@/lib/entitlements";
import { getCurrentWorkspace } from "@/lib/tenant";

export default async function NotificationsIntegrationPage() {
  const { workspace } = await getCurrentWorkspace();
  const plan = await getWorkspacePlan(workspace.id);
  if (!plan.limits.features.notifications) {
    return (
      <section className="content-card">
        <h2>Notifications Locked</h2>
        <p>Email and webhook notifications are not available on this plan.</p>
        <Link href="/billing" className="button-primary">
          Upgrade Plan
        </Link>
      </section>
    );
  }
  return <NotificationsIntegrationPanel />;
}
