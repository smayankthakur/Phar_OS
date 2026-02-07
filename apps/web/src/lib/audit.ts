import { Prisma } from "@pharos/db";
import { prisma } from "@/lib/prisma";

export type AuditActor = {
  userId: string;
  email: string;
};

export type WriteAuditInput = {
  workspaceId: string;
  actor: AuditActor;
  actionId?: string | null;
  entityType: string;
  entityId: string;
  event: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
};

export async function writeAudit(input: WriteAuditInput) {
  return prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: input.actor.userId,
      actorEmail: input.actor.email,
      actionId: input.actionId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      event: input.event,
      before: input.before ?? Prisma.JsonNull,
      after: input.after ?? Prisma.JsonNull,
    },
  });
}
