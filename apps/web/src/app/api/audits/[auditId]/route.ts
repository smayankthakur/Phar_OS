import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/apiResponse";
import { getCurrentWorkspace } from "@/lib/tenant";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ auditId: string }> },
) {
  const { workspace } = await getCurrentWorkspace();
  const { auditId } = await params;

  const audit = await prisma.auditLog.findFirst({
    where: {
      id: auditId,
      workspaceId: workspace.id,
    },
  });

  if (!audit) {
    return err("NOT_FOUND", "Audit not found", 404);
  }

  return ok({
    audit: {
      id: audit.id,
      workspaceId: audit.workspaceId,
      actorUserId: audit.actorUserId,
      actorEmail: audit.actorEmail,
      actionId: audit.actionId,
      entityType: audit.entityType,
      entityId: audit.entityId,
      event: audit.event,
      before: audit.before,
      after: audit.after,
      createdAt: audit.createdAt.toISOString(),
    },
  });
}
