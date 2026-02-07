import { z } from "zod";
import { getCurrentWorkspace } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/apiResponse";

const querySchema = z.object({
  status: z.enum(["RECOMMENDED", "APPLIED"]).default("RECOMMENDED"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(request: Request) {
  const { workspace } = await getCurrentWorkspace();
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return err("BAD_REQUEST", "Invalid query", 400);
  }

  const actions = await prisma.action.findMany({
    where: {
      workspaceId: workspace.id,
      status: parsed.data.status,
    },
    orderBy: { createdAt: "desc" },
    take: parsed.data.limit,
    include: {
      sku: {
        select: {
          id: true,
          sku: true,
          title: true,
        },
      },
      rule: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return ok({
    items: actions.map((action) => ({
      id: action.id,
      type: action.type,
      status: action.status,
      safetyStatus: action.safetyStatus,
      safetyReason: action.safetyReason,
      title: action.title,
      details: action.details,
      skuId: action.skuId,
      eventId: action.eventId,
      ruleId: action.ruleId,
      createdAt: action.createdAt.toISOString(),
      appliedAt: action.appliedAt?.toISOString() ?? null,
      sku: action.sku,
      rule: action.rule,
    })),
  });
}
