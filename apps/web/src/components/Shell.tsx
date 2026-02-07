import { SidebarNav } from "@/components/SidebarNav";
import { Topbar } from "@/components/Topbar";
import { WorkspaceCookieSync } from "@/components/WorkspaceCookieSync";
import { PageHeaderClient } from "@/components/PageHeaderClient";
import { requireSession } from "@/lib/auth";
import { getBrandingForRequest } from "@/lib/branding";
import { isClientDemoMode } from "@/lib/demoMode";
import { getWorkspacePlan } from "@/lib/entitlements";
import { getCurrentWorkspace } from "@/lib/tenant";
import { headers } from "next/headers";

export async function Shell({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { workspace, role, needsCookieSync } = await getCurrentWorkspace();
  const clientDemoMode = await isClientDemoMode();
  const plan = await getWorkspacePlan(workspace.id);
  const host = (await headers()).get("host");
  const branding = await getBrandingForRequest({ host, workspaceId: workspace.id });

  return (
    <div className="shell-root" style={branding.accentColor ? ({ ["--accent" as string]: branding.accentColor } as React.CSSProperties) : undefined}>
      <WorkspaceCookieSync workspaceId={workspace.id} needsSync={needsCookieSync} />
      <Topbar
        currentWorkspaceId={workspace.id}
        clientDemoMode={clientDemoMode}
        userEmail={session.user.email}
        role={role}
        workspaceName={workspace.name}
        branding={branding}
      />
      <div className="shell-body">
        <SidebarNav
          featureFlags={{
            portal: plan.limits.features.portal,
            shopify: plan.limits.features.shopify,
            notifications: plan.limits.features.notifications,
            demoMode: plan.limits.features.demoMode,
          }}
        />
        <main className="main-area">
          <PageHeaderClient workspaceName={workspace.name} />
          {children}
        </main>
      </div>
    </div>
  );
}
