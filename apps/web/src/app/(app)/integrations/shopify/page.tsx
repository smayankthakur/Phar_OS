import { ShopifyIntegrationPanel } from "@/components/integrations/ShopifyIntegrationPanel";
import Link from "next/link";
import { getWorkspacePlan } from "@/lib/entitlements";
import { getCurrentWorkspace } from "@/lib/tenant";

export default async function ShopifyIntegrationPage() {
  const { workspace } = await getCurrentWorkspace();
  const plan = await getWorkspacePlan(workspace.id);
  if (!plan.limits.features.shopify) {
    return (
      <section className="content-card">
        <h2>Shopify Integration Locked</h2>
        <p>Shopify sync is not available on this plan.</p>
        <Link href="/billing" className="button-primary">
          Upgrade Plan
        </Link>
      </section>
    );
  }
  return <ShopifyIntegrationPanel />;
}
