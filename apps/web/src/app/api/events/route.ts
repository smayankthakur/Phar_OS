import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/apiResponse";
import { getCurrentWorkspace } from "@/lib/tenant";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(request: Request) {
  const { workspace } = await getCurrentWorkspace();
  const url = new URL(request.url);
  let query;
  try {
    query = querySchema.parse({
      limit: url.searchParams.get("limit") ?? undefined,
    });
  } catch {
    return err("BAD_REQUEST", "Invalid query params", 400);
  }

  const events = await prisma.event.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: query.limit,
    include: {
      sku: {
        select: {
          id: true,
          sku: true,
          title: true,
        },
      },
    },
  });

  return ok({
    items: events.map((event) => ({
      id: event.id,
      workspaceId: event.workspaceId,
      skuId: event.skuId,
      type: event.type,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
      sku: event.sku,
    })),
  });
}
