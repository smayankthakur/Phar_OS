import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/apiResponse";
import { getCurrentWorkspace } from "@/lib/tenant";
import { getActionSummary, getAuditSummary, getEventSummary } from "@/lib/summaries";

type TimelineItem =
  | {
      kind: "EVENT";
      id: string;
      ts: string;
      subtype: string;
      summary: string;
      data: {
        payload: unknown;
      };
    }
  | {
      kind: "ACTION";
      id: string;
      ts: string;
      subtype: string;
      status: string;
      title: string;
      summary: string;
      ruleName?: string;
      data: {
        details: unknown;
      };
    }
  | {
      kind: "AUDIT";
      id: string;
      ts: string;
      subtype: string;
      summary: string;
      data: {
        hasBefore: boolean;
        hasAfter: boolean;
      };
    };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ skuId: string }> },
) {
  const { workspace } = await getCurrentWorkspace();
  const { skuId } = await params;

  const sku = await prisma.sKU.findFirst({
    where: {
      id: skuId,
      workspaceId: workspace.id,
    },
    select: {
      id: true,
      sku: true,
      title: true,
    },
  });

  if (!sku) {
    return err("NOT_FOUND", "SKU not found", 404);
  }

  const [events, actions, audits] = await Promise.all([
    prisma.event.findMany({
      where: {
        workspaceId: workspace.id,
        skuId: sku.id,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        payload: true,
        createdAt: true,
      },
    }),
    prisma.action.findMany({
      where: {
        workspaceId: workspace.id,
        skuId: sku.id,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        status: true,
        title: true,
        details: true,
        createdAt: true,
        appliedAt: true,
        rule: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        workspaceId: workspace.id,
        entityType: "SKU",
        entityId: sku.id,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        event: true,
        before: true,
        after: true,
        createdAt: true,
      },
    }),
  ]);

  const eventItems: TimelineItem[] = events.map((event) => ({
    kind: "EVENT",
    id: event.id,
    ts: event.createdAt.toISOString(),
    subtype: event.type,
    summary: getEventSummary(event.type, event.payload),
    data: {
      payload: event.payload,
    },
  }));

  const actionItems: TimelineItem[] = actions.map((action) => ({
    kind: "ACTION",
    id: action.id,
    ts: (action.appliedAt ?? action.createdAt).toISOString(),
    subtype: action.type,
    status: action.status,
    title: action.title,
    summary: getActionSummary(action.title),
    ruleName: action.rule?.name,
    data: {
      details: action.details,
    },
  }));

  const auditItems: TimelineItem[] = audits.map((audit) => ({
    kind: "AUDIT",
    id: audit.id,
    ts: audit.createdAt.toISOString(),
    subtype: audit.event,
    summary: getAuditSummary(audit.event),
    data: {
      hasBefore: audit.before !== null,
      hasAfter: audit.after !== null,
    },
  }));

  const items = [...eventItems, ...actionItems, ...auditItems].sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
  );

  return ok({
    sku,
    items,
  });
}
