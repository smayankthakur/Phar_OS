import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { EntitlementError, requireFeature } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/tenant";

const querySchema = z.object({
  status: z.enum(["QUEUED", "RUNNING", "SENT", "FAILED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: Request) {
  const { workspace } = await getCurrentWorkspace();
  try {
    await requireFeature(workspace.id, "notifications");
  } catch (error) {
    if (error instanceof EntitlementError) return err("FORBIDDEN", error.message, 403);
    return err("INTERNAL", "Failed to resolve notifications entitlement", 500);
  }
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return err("BAD_REQUEST", "Invalid query params", 400);
  }

  const outbox = await prisma.notificationOutbox.findMany({
    where: {
      workspaceId: workspace.id,
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: parsed.data.limit,
  });

  return ok({
    items: outbox.map((item) => ({
      id: item.id,
      workspaceId: item.workspaceId,
      actionId: item.actionId,
      type: item.type,
      status: item.status,
      attempts: item.attempts,
      lastError: item.lastError,
      sentAt: item.sentAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  });
}
