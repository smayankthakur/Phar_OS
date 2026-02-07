import { err, ok } from "@/lib/apiResponse";
import { getWorkspaceByToken } from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { getEventSummary } from "@/lib/summaries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const access = await getWorkspaceByToken(token);
  if (!access) {
    return err("NOT_FOUND", "Portal not found", 404);
  }

  const events = await prisma.event.findMany({
    where: { workspaceId: access.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: {
      sku: {
        select: {
          sku: true,
          title: true,
        },
      },
    },
  });

  return ok({
    items: events.map((event) => ({
      type: event.type,
      summary: getEventSummary(event.type, event.payload),
      createdAt: event.createdAt.toISOString(),
      sku: event.sku ? { sku: event.sku.sku, title: event.sku.title } : null,
    })),
  });
}
