import Link from "next/link";
import { HelpQuickActions } from "@/components/help/HelpQuickActions";
import { SystemStatusCard } from "@/components/help/SystemStatusCard";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { isClientDemoMode } from "@/lib/demoMode";
import { getCurrentWorkspace } from "@/lib/tenant";

export default async function HelpPage() {
  const { workspace } = await getCurrentWorkspace();
  const demoMode = await isClientDemoMode();

  return (
    <div className="detail-grid">
      <Card>
        <CardHeader>
          <h2>Operator Runbook</h2>
          <p>Quick execution guide for demos and pilot operations.</p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <h3>2-Minute Demo Script</h3>
        </CardHeader>
        <CardContent>
          <ol>
            <li>
              Open <Link href="/client-demo">Client Demo Landing</Link> and enter demo workspace.
            </li>
            <li>
              Go to <Link href="/demo">Demo</Link>, reset dataset, and run competitor drop.
            </li>
            <li>
              Open <Link href="/">Command Center</Link> recommendations and apply top action.
            </li>
            <li>
              Open SKU timeline and inspect audit entry.
            </li>
          </ol>
          <p>Docs reference: <code>docs/02-demo-script.md</code></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3>Pilot Onboarding</h3>
        </CardHeader>
        <CardContent>
          <ul>
            <li>Create workspace and baseline demo dataset.</li>
            <li>Add SKUs and competitors for client catalog.</li>
            <li>Import competitor CSV from SKU page.</li>
            <li>Set guardrails in Settings before live operations.</li>
          </ul>
          <p>Full guide: <code>docs/03-pilot-onboarding.md</code></p>
        </CardContent>
      </Card>

      <SystemStatusCard workspaceId={workspace.id} workspaceName={workspace.name} demoMode={demoMode} />

      <Card>
        <CardHeader>
          <h3>Quick Actions</h3>
        </CardHeader>
        <CardContent>
          <HelpQuickActions clientDemoMode={demoMode} />
        </CardContent>
      </Card>
    </div>
  );
}
