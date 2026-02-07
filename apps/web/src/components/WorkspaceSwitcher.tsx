import { getWorkspaceMembershipsForCurrentUser } from "@/lib/tenant";
import { WorkspaceSwitcherClient } from "@/components/WorkspaceSwitcherClient";

export async function WorkspaceSwitcher({ currentWorkspaceId }: { currentWorkspaceId: string }) {
  const memberships = await getWorkspaceMembershipsForCurrentUser();
  const workspaces = memberships.map((membership) => membership.workspace);

  return <WorkspaceSwitcherClient workspaces={workspaces} currentWorkspaceId={currentWorkspaceId} />;
}
