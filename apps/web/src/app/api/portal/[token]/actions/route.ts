import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { getWorkspaceByToken } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  status: z.enum(["RECOMMENDED", "APPLIED"]).default("RECOMMENDED"),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const access = await getWorkspaceByToken(token);
  if (!access) {
    return err("NOT_FOUND", "Portal not found", 404);
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
  });

  if (!parsed.success) {
    return err("BAD_REQUEST", "Invalid status", 400);
  }

  const actions = await prisma.action.findMany({
    where: {
      workspaceId: access.workspaceId,
      status: parsed.data.status,
    },
    orderBy: parsed.data.status === "APPLIED" ? { appliedAt: "desc" } : { createdAt: "desc" },
    take: 25,
    include: {
      sku: {
        select: {
          sku: true,
          title: true,
        },
      },
      rule: {
        select: {
          name: true,
        },
      },
    },
  });

  return ok({
    status: parsed.data.status,
    items: actions.map((action) => ({
      type: action.type,
      title: action.title,
      safetyStatus: action.safetyStatus,
      safetyReason: action.safetyReason,
      createdAt: action.createdAt.toISOString(),
      appliedAt: action.appliedAt?.toISOString() ?? null,
      sku: action.sku ? { sku: action.sku.sku, title: action.sku.title } : null,
      ruleName: action.rule?.name ?? null,
    })),
  });
}
