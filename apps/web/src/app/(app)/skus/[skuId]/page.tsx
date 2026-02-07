import { notFound } from "next/navigation";
import Link from "next/link";
import { calcMarginPercent, calcMarginValue } from "@pharos/core";
import { MetricCard } from "@/components/cards/MetricCard";
import { SkuForm } from "@/components/forms/SkuForm";
import { SkuCompetitorPanel } from "@/components/SkuCompetitorPanel";
import { SkuShopifyMappingForm } from "@/components/SkuShopifyMappingForm";
import { SkuTimelineSection } from "@/components/sku/SkuTimelineSection";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/tenant";

type PageTab = "overview" | "competitors" | "timeline";

function parseTab(input: string | undefined): PageTab {
  if (input === "competitors") return "competitors";
  if (input === "timeline") return "timeline";
  return "overview";
}

export default async function SkuDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ skuId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { workspace } = await getCurrentWorkspace();
  const { skuId } = await params;
  const { tab } = await searchParams;
  const activeTab = parseTab(tab);

  const sku = await prisma.sKU.findFirst({
    where: {
      id: skuId,
      workspaceId: workspace.id,
    },
  });

  if (!sku) {
    notFound();
  }

  const cost = sku.cost.toNumber();
  const currentPrice = sku.currentPrice.toNumber();
  const marginPercent = calcMarginPercent(cost, currentPrice);
  const marginValue = calcMarginValue(cost, currentPrice);
  const [competitors, snapshots, lastAppliedAction] = await Promise.all([
    prisma.competitor.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, currency: true },
    }),
    prisma.competitorSnapshot.findMany({
      where: { workspaceId: workspace.id, skuId: sku.id },
      orderBy: { capturedAt: "desc" },
      include: {
        competitor: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
      },
    }),
    prisma.action.findFirst({
      where: {
        workspaceId: workspace.id,
        skuId: sku.id,
        status: "APPLIED",
      },
      orderBy: { appliedAt: "desc" },
      select: {
        id: true,
        type: true,
        title: true,
        appliedAt: true,
      },
    }),
  ]);

  const latestByCompetitor = new Map<
    string,
    {
      competitorId: string;
      competitorName: string;
      currency: string;
      price: number;
      capturedAt: string;
    }
  >();

  for (const snapshot of snapshots) {
    if (latestByCompetitor.has(snapshot.competitorId)) continue;
    latestByCompetitor.set(snapshot.competitorId, {
      competitorId: snapshot.competitorId,
      competitorName: snapshot.competitor.name,
      currency: snapshot.competitor.currency,
      price: snapshot.price.toNumber(),
      capturedAt: snapshot.capturedAt.toISOString(),
    });
  }

  return (
    <div className="detail-grid">
      <section className="content-card">
        <h2>{sku.title}</h2>
        <p>{sku.sku}</p>
        <div className="row-actions">
          <Link href={`/skus/${sku.id}?tab=overview`} className={activeTab === "overview" ? "button-primary" : "button-secondary"}>
            Overview
          </Link>
          <Link
            href={`/skus/${sku.id}?tab=competitors`}
            className={activeTab === "competitors" ? "button-primary" : "button-secondary"}
          >
            Competitor Prices
          </Link>
          <Link href={`/skus/${sku.id}?tab=timeline`} className={activeTab === "timeline" ? "button-primary" : "button-secondary"}>
            Timeline
          </Link>
        </div>
      </section>

      {activeTab === "overview" ? (
        <>
          <section className="content-card">
            <h3>Summary</h3>
            <div className="metric-grid">
              <MetricCard label="Cost" value={formatMoney(cost)} />
              <MetricCard label="Price" value={formatMoney(currentPrice)} />
              <MetricCard label="Margin %" value={`${marginPercent.toFixed(2)}%`} />
              <MetricCard label="Margin Value" value={formatMoney(marginValue)} />
            </div>
            {lastAppliedAction ? (
              <p>
                Last applied action: {lastAppliedAction.type} at{" "}
                {lastAppliedAction.appliedAt?.toLocaleString() ?? "n/a"}
              </p>
            ) : null}
          </section>

          <section className="content-card">
            <h3>Edit SKU</h3>
            <SkuForm
              mode="edit"
              skuId={sku.id}
              submitLabel="Save changes"
              initialValues={{
                title: sku.title,
                sku: sku.sku,
                cost,
                currentPrice,
                status: sku.status,
              }}
              fields={["cost", "currentPrice", "status"]}
            />
          </section>

          <section className="content-card">
            <h3>Shopify Mapping</h3>
            <p className="metric-note">
              Provide Shopify Variant ID to enable &quot;Push to Shopify&quot; for applied pricing actions.
            </p>
            <SkuShopifyMappingForm
              skuId={sku.id}
              initialProductId={sku.shopifyProductId}
              initialVariantId={sku.shopifyVariantId}
            />
          </section>
        </>
      ) : null}

      {activeTab === "competitors" ? (
        <SkuCompetitorPanel
          skuId={sku.id}
          ourPrice={currentPrice}
          competitors={competitors}
          latestRows={[...latestByCompetitor.values()]}
        />
      ) : null}

      {activeTab === "timeline" ? <SkuTimelineSection skuId={sku.id} /> : null}
    </div>
  );
}
