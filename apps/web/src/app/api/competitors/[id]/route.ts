import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { requireOwner } from "@/lib/rbac";
import { getCurrentWorkspace } from "@/lib/tenant";
import { isUniqueError, toCompetitorDTO, updateCompetitorSchema } from "@/lib/competitors";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await getCurrentWorkspace();
  const { id } = await params;

  const existing = await prisma.competitor.findFirst({
    where: {
      id,
      workspaceId: workspace.id,
    },
  });

  if (!existing) {
    return err("NOT_FOUND", "Competitor not found", 404);
  }

  let payload;
  try {
    payload = updateCompetitorSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return err("BAD_REQUEST", "Invalid competitor payload", 400);
    }
    return err("BAD_REQUEST", "Invalid request body", 400);
  }

  try {
    const updated = await prisma.competitor.update({
      where: { id: existing.id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.domain !== undefined ? { domain: payload.domain || null } : {}),
        ...(payload.currency !== undefined ? { currency: payload.currency.toUpperCase() } : {}),
      },
    });

    return ok({ item: toCompetitorDTO(updated) });
  } catch (error) {
    if (isUniqueError(error)) {
      return err("CONFLICT", "Competitor name already exists in this workspace", 409);
    }
    return err("INTERNAL", "Failed to update competitor", 500);
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
    return err("INTERNAL", "Failed to authorize competitor deletion", 500);
  }
  const { id } = await params;

  const existing = await prisma.competitor.findFirst({
    where: {
      id,
      workspaceId: workspace.id,
    },
    select: { id: true },
  });

  if (!existing) {
    return err("NOT_FOUND", "Competitor not found", 404);
  }

  await prisma.competitor.delete({ where: { id: existing.id } });

  return ok({});
}
