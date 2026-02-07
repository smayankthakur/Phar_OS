import { parseEventInput, type EventType } from "@pharos/core";
import type { Prisma } from "@pharos/db";
import { prisma } from "@/lib/prisma";

export type EventDTO = {
  id: string;
  workspaceId: string;
  skuId: string | null;
  type: string;
  payload: Prisma.JsonValue;
  createdAt: string;
};

export async function ensureWorkspaceSku(workspaceId: string, skuId: string) {
  return prisma.sKU.findFirst({
    where: {
      id: skuId,
      workspaceId,
    },
  });
}

export async function createWorkspaceEvent(input: {
  workspaceId: string;
  type: EventType;
  payload: unknown;
  skuId?: string | null;
}) {
  const parsed = parseEventInput({ type: input.type, payload: input.payload });
  const payloadSkuId = parsed.payload.skuId;
  const resolvedSkuId = input.skuId ?? payloadSkuId;

  if (resolvedSkuId !== payloadSkuId) {
    throw new Error("skuId mismatch between payload and body");
  }

  const sku = await ensureWorkspaceSku(input.workspaceId, resolvedSkuId);
  if (!sku) {
    return null;
  }

  const created = await prisma.event.create({
    data: {
      workspaceId: input.workspaceId,
      skuId: sku.id,
      type: parsed.type,
      payload: parsed.payload as Prisma.JsonObject,
    },
  });

  return created;
}

export function toEventDTO(event: {
  id: string;
  workspaceId: string;
  skuId: string | null;
  type: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
}): EventDTO {
  return {
    id: event.id,
    workspaceId: event.workspaceId,
    skuId: event.skuId,
    type: event.type,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}
