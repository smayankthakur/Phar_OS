import { updateRuleSchema } from "@pharos/core";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { requireOwner } from "@/lib/rbac";
import { getCurrentWorkspace } from "@/lib/tenant";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await getCurrentWorkspace();
  const { id } = await params;

  const rule = await prisma.rule.findFirst({
    where: {
      id,
      workspaceId: workspace.id,
    },
  });

  if (!rule) {
    return err("NOT_FOUND", "Rule not found", 404);
  }

  return ok({
    item: {
      ...rule,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await getCurrentWorkspace();
  try {
    await requireOwner(workspace.id);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize rule update", 500);
  }
  const { id } = await params;

  const existing = await prisma.rule.findFirst({
    where: {
      id,
      workspaceId: workspace.id,
    },
  });

  if (!existing) {
    return err("NOT_FOUND", "Rule not found", 404);
  }

  let payload;
  try {
    payload = updateRuleSchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid rule payload", 400);
  }

  try {
    const updated = await prisma.rule.update({
      where: { id: existing.id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.eventType !== undefined ? { eventType: payload.eventType } : {}),
        ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
        ...(payload.condition !== undefined ? { condition: payload.condition } : {}),
        ...(payload.actionTemplate !== undefined ? { actionTemplate: payload.actionTemplate } : {}),
      },
    });

    return ok({
      item: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch {
    return err("CONFLICT", "Rule name already exists in this workspace", 409);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await getCurrentWorkspace();
  try {
    await requireOwner(workspace.id);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize rule deletion", 500);
  }
  const { id } = await params;

  const existing = await prisma.rule.findFirst({
    where: {
      id,
      workspaceId: workspace.id,
    },
    select: { id: true },
  });

  if (!existing) {
    return err("NOT_FOUND", "Rule not found", 404);
  }

  await prisma.rule.delete({ where: { id: existing.id } });
  return ok({});
}
