import { createRuleSchema } from "@pharos/core";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { requireOwner } from "@/lib/rbac";
import { getCurrentWorkspace } from "@/lib/tenant";

export async function GET() {
  const { workspace } = await getCurrentWorkspace();

  const rules = await prisma.rule.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" },
  });

  return ok({
    items: rules.map((rule) => ({
      ...rule,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const { workspace } = await getCurrentWorkspace();
  try {
    await requireOwner(workspace.id);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize rule creation", 500);
  }

  let payload;
  try {
    payload = createRuleSchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid rule payload", 400);
  }

  try {
    const created = await prisma.rule.create({
      data: {
        workspaceId: workspace.id,
        name: payload.name,
        eventType: payload.eventType,
        enabled: payload.enabled,
        condition: payload.condition,
        actionTemplate: payload.actionTemplate,
      },
    });

    return ok(
      {
        item: {
          ...created,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      201,
    );
  } catch {
    return err("CONFLICT", "Rule name already exists in this workspace", 409);
  }
}
