import { PricingSettingsForm } from "@/components/settings/PricingSettingsForm";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { getCurrentWorkspace } from "@/lib/tenant";
import { getPricingSettings } from "@/lib/settings";

export default async function SettingsPage() {
  const { workspace } = await getCurrentWorkspace();
  const settings = await getPricingSettings(workspace.id);

  return (
    <Card>
      <CardHeader>
        <h2>Pricing Guardrails</h2>
        <p>Workspace safety rules applied during recommendation and action apply.</p>
      </CardHeader>
      <CardContent>
        <PricingSettingsForm initial={settings} />
      </CardContent>
    </Card>
  );
}
