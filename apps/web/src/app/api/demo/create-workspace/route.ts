import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { EntitlementError, requireFeature } from "@/lib/entitlements";
import { resetWorkspaceDemoDataset } from "@/lib/demoSeed";
import { ensureWorkspaceSubscription } from "@/lib/plans";
import { getCurrentWorkspace, setWorkspaceCookie } from "@/lib/tenant";
import { setClientDemoModeCookie } from "@/lib/demoMode";
import { requireOwner } from "@/lib/rbac";

export async function POST(request: Request) {
  try {
    await verifyCsrf(request);
    const current = await getCurrentWorkspace();
    await requireFeature(current.workspace.id, "demoMode");
    const actor = await requireOwner(current.workspace.id);

    const workspace = await prisma.workspace.create({
      data: {
        name: `Client Demo - ${new Date().toISOString()}`,
      },
      select: { id: true },
    });

    await prisma.membership.create({
      data: {
        userId: actor.userId,
        workspaceId: workspace.id,
        role: "OWNER",
      },
    });
    await ensureWorkspaceSubscription(workspace.id);

    await resetWorkspaceDemoDataset(workspace.id);

    const response = ok({ workspaceId: workspace.id });
    setWorkspaceCookie(response, workspace.id);
    setClientDemoModeCookie(response);
    return response;
  } catch (error) {
    if (error instanceof CsrfError) {
      return err("CSRF_INVALID", error.message, 403);
    }
    if (error instanceof EntitlementError) {
      return err("FORBIDDEN", error.message, 403);
    }
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", error instanceof Error ? error.message : "Failed to create demo workspace", 500);
  }
}
