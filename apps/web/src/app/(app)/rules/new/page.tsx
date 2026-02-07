import { RuleEditor } from "@/components/RuleEditor";
import { getCurrentWorkspace } from "@/lib/tenant";

export default async function NewRulePage() {
  const { role } = await getCurrentWorkspace();
  return <RuleEditor mode="create" ownerMode={role === "OWNER"} />;
}
