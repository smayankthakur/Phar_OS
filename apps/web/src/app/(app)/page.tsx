import { Prisma } from "@pharos/db";
import { ApplyActionButton } from "@/components/ApplyActionButton";
import { PushToShopifyButton } from "@/components/PushToShopifyButton";
import { QuickActions } from "@/components/QuickActions";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { isClientDemoMode } from "@/lib/demoMode";
import { formatMoney, formatTs } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/tenant";

function formatPayloadSummary(type: string, payload: Prisma.JsonValue) {
  const value = payload as Record<string, unknown>;

  if (type === "COMPETITOR_PRICE_DROP") {
    return `Competitor price changed ${value.oldPrice} -> ${value.newPrice}`;
  }

  if (type === "COST_INCREASE") {
    return `Cost ${value.oldCost} -> ${value.newCost}`;
  }

  if (type === "STOCK_LOW") {
    return `Available ${value.available} below threshold ${value.threshold}`;
  }

  return "Signal received";
}

function actionGuardrailMeta(details: Prisma.JsonValue) {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return { adjusted: false, original: null as number | null, final: null as number | null };
  }
  const data = details as Record<string, unknown>;
  const original = typeof data.suggestedPriceOriginal === "number" ? data.suggestedPriceOriginal : null;
  const final = typeof data.suggestedPriceFinal === "number" ? data.suggestedPriceFinal : null;
  const guardrails =
    data.guardrails && typeof data.guardrails === "object" && !Array.isArray(data.guardrails)
      ? (data.guardrails as Record<string, unknown>)
      : null;
  const adjusted = guardrails && typeof guardrails.adjusted === "boolean" ? guardrails.adjusted : false;
  return { adjusted, original, final };
}

function isPriceAction(type: string) {
  return type === "PRICE_MATCH" || type === "PRICE_INCREASE";
}

export default async function CommandCenterPage() {
  const { workspace } = await getCurrentWorkspace();
  const clientDemoMode = await isClientDemoMode();

  const [events, recommendedActions, appliedActions, recentShopifyJobs, recentNotificationOutbox] = await Promise.all([
    prisma.event.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        sku: {
          select: {
            id: true,
            sku: true,
            title: true,
          },
        },
      },
    }),
    prisma.action.findMany({
      where: {
        workspaceId: workspace.id,
        status: "RECOMMENDED",
      },
      orderBy: { createdAt: "desc" },
      take: 50,
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
            name: true,
          },
        },
      },
    }),
    prisma.action.findMany({
      where: {
        workspaceId: workspace.id,
        status: "APPLIED",
      },
      orderBy: { appliedAt: "desc" },
      take: 20,
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
            name: true,
          },
        },
      },
    }),
    prisma.shopifyJob.findMany({
      where: {
        workspaceId: workspace.id,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        actionId: true,
        skuId: true,
        status: true,
        lastError: true,
        createdAt: true,
      },
    }),
    prisma.notificationOutbox.findMany({
      where: {
        workspaceId: workspace.id,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        actionId: true,
        status: true,
        lastError: true,
      },
    }),
  ]);

  const latestJobByActionId = new Map<string, (typeof recentShopifyJobs)[number]>();
  const latestJobBySkuId = new Map<string, (typeof recentShopifyJobs)[number]>();
  for (const job of recentShopifyJobs) {
    if (job.actionId && !latestJobByActionId.has(job.actionId)) {
      latestJobByActionId.set(job.actionId, job);
    }
    if (job.skuId && !latestJobBySkuId.has(job.skuId)) {
      latestJobBySkuId.set(job.skuId, job);
    }
  }

  const latestNotifyByActionId = new Map<string, (typeof recentNotificationOutbox)[number]>();
  for (const item of recentNotificationOutbox) {
    if (!item.actionId) continue;
    if (!latestNotifyByActionId.has(item.actionId)) {
      latestNotifyByActionId.set(item.actionId, item);
    }
  }

  return (
    <div className="detail-grid">
      <Card className="page-intro">
        <CardHeader>
          <h2>Command Center</h2>
          <p>Run demo simulations and inspect latest signals.</p>
        </CardHeader>
        <CardContent>
          <QuickActions clientDemoMode={clientDemoMode} />
        </CardContent>
      </Card>

      <div className="two-col">
        <Card>
          <CardHeader>
            <h3>Signals</h3>
          </CardHeader>
          <div className="signals-list">
            {events.map((event) => (
              <article key={event.id} className="signal-card">
                <div className="signal-top">
                  <Badge>{event.type}</Badge>
                  <span className="signal-time" title={formatTs(event.createdAt).title}>{formatTs(event.createdAt).label}</span>
                </div>
                <p className="signal-sku">
                  SKU: {event.sku?.title ?? "N/A"} ({event.sku?.sku ?? "-"})
                </p>
                <p className="signal-summary">{formatPayloadSummary(event.type, event.payload)}</p>
              </article>
            ))}
            {events.length === 0 ? <EmptyState title="No signals yet" description="Run a demo simulation to generate events." /> : null}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <h3>Recommended Actions</h3>
          </CardHeader>
          <div className="signals-list">
            {recommendedActions.map((action) => (
              <article key={action.id} className="signal-card">
                <div className="signal-top">
                  {action.safetyStatus === "BLOCKED" ? <Badge tone="breach">BLOCKED</Badge> : <Badge tone="warn">{action.type}</Badge>}
                  <span className="signal-time" title={formatTs(action.createdAt).title}>{formatTs(action.createdAt).label}</span>
                </div>
                <p className="signal-sku">
                  SKU: {action.sku?.title ?? "N/A"} ({action.sku?.sku ?? "-"})
                </p>
                <p className="signal-summary">{action.title}</p>
                <p className="signal-summary">Reason: {action.rule?.name ?? "Rule-based recommendation"}</p>
                {action.safetyStatus === "BLOCKED" ? (
                  <p className="form-error">Guardrail: {action.safetyReason ?? "Action blocked by guardrails"}</p>
                ) : null}
                <p className="signal-summary">
                  Suggested: {(() => {
                    const meta = actionGuardrailMeta(action.details);
                    const price = meta.final;
                    return price !== null ? formatMoney(price) : "n/a";
                  })()}
                </p>
                {(() => {
                  const meta = actionGuardrailMeta(action.details);
                  if (!meta.adjusted || meta.original === null || meta.final === null || meta.original === meta.final) return null;
                  return (
                    <p className="signal-summary">
                      Adjusted by guardrails: {formatMoney(meta.original)} {"->"} {formatMoney(meta.final)}
                    </p>
                  );
                })()}
                <div className="row-actions">
                  <ApplyActionButton
                    actionId={action.id}
                    disabled={action.safetyStatus === "BLOCKED"}
                    disabledLabel="Blocked"
                  />
                </div>
              </article>
            ))}
            {recommendedActions.length === 0 ? <EmptyState title="No recommendations" description="Rules will recommend actions after incoming signals." /> : null}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3>Applied Actions</h3>
        </CardHeader>
        <div className="signals-list">
          {appliedActions.map((action) => (
            <article key={action.id} className="signal-card">
              <div className="signal-top">
                <Badge tone="ok">{action.type}</Badge>
                <span className="signal-time">
                  Applied {action.appliedAt ? formatTs(action.appliedAt).label : formatTs(action.createdAt).label}
                </span>
              </div>
              <p className="signal-sku">
                SKU: {action.sku?.title ?? "N/A"} ({action.sku?.sku ?? "-"})
              </p>
              <p className="signal-summary">Reason: {action.rule?.name ?? "Rule-based recommendation"}</p>
              {action.type === "NOTIFY"
                ? (() => {
                    const notify = latestNotifyByActionId.get(action.id);
                    if (!notify) return <p className="signal-summary">Notify dispatch: Not queued</p>;
                    return (
                      <p className="signal-summary">
                        Notify dispatch: {notify.status}
                        {notify.lastError ? ` (${notify.lastError})` : ""}
                      </p>
                    );
                  })()
                : null}
              {(() => {
                const job = latestJobByActionId.get(action.id) ?? (action.skuId ? latestJobBySkuId.get(action.skuId) : undefined);
                if (!job) return null;
                return (
                  <p className="signal-summary">
                    Shopify job: {job.status}
                    {job.lastError ? ` (${job.lastError})` : ""}
                  </p>
                );
              })()}
              {(() => {
                if (!action.skuId || !action.sku || !isPriceAction(action.type)) return null;
                const meta = actionGuardrailMeta(action.details);
                if (meta.final === null) return null;
                const existingJob = latestJobByActionId.get(action.id) ?? latestJobBySkuId.get(action.skuId);
                const disabled = existingJob?.status === "QUEUED" || existingJob?.status === "RUNNING";
                return (
                  <div className="row-actions">
                    <PushToShopifyButton
                      skuId={action.skuId}
                      actionId={action.id}
                      newPrice={meta.final}
                      disabled={disabled}
                    />
                  </div>
                );
              })()}
            </article>
          ))}
          {appliedActions.length === 0 ? <p className="signal-summary">No applied actions yet.</p> : null}
        </div>
      </Card>
    </div>
  );
}
