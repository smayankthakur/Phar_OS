import { z } from "zod";
import { AuthError } from "@/lib/auth";
import { err, ok } from "@/lib/apiResponse";
import { EntitlementError, requireBillingWriteAccess, requireFeature, requireWithinLimit } from "@/lib/entitlements";
import { generateToken } from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/rbac";
import { logTelemetry } from "@/lib/telemetry";
import { getCurrentWorkspace } from "@/lib/tenant";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  expiresInDays: z.number().int().positive().max(365).optional(),
});

export async function GET() {
  const { workspace } = await getCurrentWorkspace();
  try {
    await requireFeature(workspace.id, "portal");
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    return err("INTERNAL", "Failed to resolve portal entitlement", 500);
  }

  const items = await prisma.portalToken.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      token: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  return ok({
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      expiresAt: item.expiresAt?.toISOString() ?? null,
      revokedAt: item.revokedAt?.toISOString() ?? null,
      status: item.revokedAt ? "REVOKED" : item.expiresAt && item.expiresAt <= new Date() ? "EXPIRED" : "ACTIVE",
    })),
  });
}

export async function POST(request: Request) {
  const { workspace } = await getCurrentWorkspace();
  try {
    await requireOwner(workspace.id);
    await requireFeature(workspace.id, "portal");
    await requireBillingWriteAccess(workspace.id, "portal_token_create");
    await requireWithinLimit(workspace.id, "portalTokens", 1);
  } catch (error) {
    if (error instanceof EntitlementError) {
      return err("FORBIDDEN", error.message, 403);
    }
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize portal token creation", 500);
  }

  let payload: z.infer<typeof createSchema>;
  try {
    payload = createSchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid token payload", 400);
  }

  const expiresAt =
    typeof payload.expiresInDays === "number"
      ? new Date(Date.now() + payload.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  try {
    const created = await prisma.portalToken.create({
      data: {
        workspaceId: workspace.id,
        name: payload.name,
        token: generateToken(),
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        token: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    await logTelemetry(prisma, workspace.id, "PORTAL_TOKEN_CREATED", {
      tokenId: created.id,
      expiresAt: created.expiresAt?.toISOString() ?? null,
    });

    return ok(
      {
        item: {
          ...created,
          createdAt: created.createdAt.toISOString(),
          expiresAt: created.expiresAt?.toISOString() ?? null,
          revokedAt: created.revokedAt?.toISOString() ?? null,
          status: "ACTIVE",
        },
      },
      201,
    );
  } catch {
    return err("INTERNAL", "Failed to create portal token", 500);
  }
}
