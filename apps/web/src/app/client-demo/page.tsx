import { ClientDemoEnterButton } from "@/components/demo/ClientDemoEnterButton";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default function ClientDemoLandingPage() {
  return (
    <main className="main-area">
      <div className="detail-grid">
        <Card>
          <CardHeader>
            <h1>PharOS Beta Command Center</h1>
            <p>Real-time pricing operations for pilot teams: detect market movement, recommend safe actions, and track execution.</p>
          </CardHeader>
          <CardContent>
            <ClientDemoEnterButton />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2>What you will see in this demo</h2>
          </CardHeader>
          <CardContent>
            <ul>
              <li>Signal ingestion from inventory and competitor price changes.</li>
              <li>Rules-based recommendations with pricing guardrails.</li>
              <li>Action apply flow with timeline and audit visibility.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2>The Closed Loop</h2>
          </CardHeader>
          <CardContent>
            <div className="row-actions">
              <Badge>Signal</Badge>
              <span>{">"}</span>
              <Badge tone="warn">Decision</Badge>
              <span>{">"}</span>
              <Badge tone="ok">Action</Badge>
            </div>
            <p className="metric-note">Signals trigger rules, rules generate recommendations, and applied actions update SKU state with audit trails.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
