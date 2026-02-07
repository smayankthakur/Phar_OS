import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireSessionForApi } from "@/lib/auth";
import { ensureDefaultRules } from "@/lib/tenant";
import { err, ok } from "@/lib/apiResponse";
import { ensureWorkspaceNotificationSettings } from "@/lib/notify";
import { ensureWorkspaceSubscription } from "@/lib/plans";
import { ensureWorkspaceSettings } from "@/lib/settings";
import { ensureWorkspaceShopifySettings } from "@/lib/shopifyClient";
import { createWorkspaceSchema, parseJsonBody } from "@/lib/validation";

export async function GET() {
  try {
    const session = await requireSessionForApi();

    const memberships = await prisma.membership.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "asc" },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
        },
      },
    });

    return ok({
      items: memberships.map((membership) => ({
        ...membership.workspace,
        role: membership.role,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to load workspaces", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSessionForApi();
    const payload = await parseJsonBody(request, createWorkspaceSchema);

    const workspace = await prisma.workspace.create({
      data: {
        name: payload.name,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    await prisma.membership.create({
      data: {
        userId: session.userId,
        workspaceId: workspace.id,
        role: "OWNER",
      },
    });

    await ensureDefaultRules(workspace.id);
    await ensureWorkspaceSubscription(workspace.id);
    await ensureWorkspaceSettings(workspace.id);
    await ensureWorkspaceShopifySettings(workspace.id);
    await ensureWorkspaceNotificationSettings(workspace.id);

    return ok({ item: workspace }, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    if (error instanceof ZodError) {
      return err("BAD_REQUEST", "Invalid workspace payload", 400);
    }
    return err("INTERNAL", "Failed to create workspace", 500);
  }
}
