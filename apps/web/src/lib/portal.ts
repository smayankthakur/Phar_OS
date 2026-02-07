import { randomBytes } from "crypto";
import { PLAN_DEFS, type PlanTier } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

export function generateToken() {
  return randomBytes(24).toString("base64url");
}

export async function getWorkspaceByToken(token: string) {
  const now = new Date();
  const tokenRow = await prisma.portalToken.findUnique({
    where: { token },
    select: {
      id: true,
      workspaceId: true,
      revokedAt: true,
      expiresAt: true,
      workspace: {
        select: {
          id: true,
          name: true,
          subscription: {
            select: {
              plan: true,
            },
          },
        },
      },
    },
  });

  if (!tokenRow) return null;
  if (tokenRow.revokedAt) return null;
  if (tokenRow.expiresAt && tokenRow.expiresAt <= now) return null;
  const plan = (tokenRow.workspace.subscription?.plan ?? "STARTER") as PlanTier;
  if (!PLAN_DEFS[plan].features.portal) return null;

  return {
    tokenId: tokenRow.id,
    workspaceId: tokenRow.workspaceId,
    workspace: tokenRow.workspace,
  };
}
