import { BillingClient } from "@/components/BillingClient";
import { getCurrentWorkspace } from "@/lib/tenant";

export default async function BillingPage() {
  const { role } = await getCurrentWorkspace();
  return <BillingClient ownerMode={role === "OWNER"} />;
}
