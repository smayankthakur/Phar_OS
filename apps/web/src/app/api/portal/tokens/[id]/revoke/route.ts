import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { EntitlementError, requireFeature } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/rbac";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace } from "@/lib/tenant";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspace } = await getCurrentWorkspace();
  try {
    await requireOwner(workspace.id);
    await requireFeature(workspace.id, "portal");
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize portal token revoke", 500);
  }
  const { id } = await params;

  const token = await prisma.portalToken.findFirst({
    where: {
      id,
      workspaceId: workspace.id,
    },
    select: {
      id: true,
      revokedAt: true,
    },
  });

  if (!token) {
    return err("NOT_FOUND", "Portal token not found", 404);
  }

  if (token.revokedAt) {
    return ok({ alreadyRevoked: true });
  }

  const updated = await prisma.portalToken.update({
    where: { id: token.id },
    data: { revokedAt: new Date() },
    select: { id: true, revokedAt: true },
  });

  await logTelemetry(prisma, workspace.id, "PORTAL_TOKEN_REVOKED", {
    tokenId: updated.id,
  });

  return ok({
    item: {
      id: updated.id,
      revokedAt: updated.revokedAt?.toISOString() ?? null,
    },
  });
}
