import { AuthError, requireSessionForApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AppRole = "OWNER" | "ANALYST";

const ROLE_WEIGHT: Record<AppRole, number> = {
  ANALYST: 1,
  OWNER: 2,
};

export async function getActorAndRole(workspaceId: string) {
  const session = await requireSessionForApi();

  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: session.userId,
        workspaceId,
      },
    },
    select: {
      role: true,
    },
  });

  if (!membership) {
    throw new AuthError("Forbidden", 403);
  }

  return {
    user: session.user,
    userId: session.userId,
    role: membership.role as AppRole,
    sessionId: session.id,
  };
}

export async function requireRole(workspaceId: string, minRole: AppRole) {
  const actor = await getActorAndRole(workspaceId);
  if (ROLE_WEIGHT[actor.role] < ROLE_WEIGHT[minRole]) {
    throw new AuthError("Insufficient permissions", 403);
  }
  return actor;
}

export async function requireOwner(workspaceId: string) {
  return requireRole(workspaceId, "OWNER");
}
