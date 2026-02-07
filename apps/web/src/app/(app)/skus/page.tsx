import Link from "next/link";
import { calcMarginPercent } from "@pharos/core";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/tenant";
import { SkuTableClient } from "@/components/SkuTableClient";

export default async function SkusPage() {
  const { workspace } = await getCurrentWorkspace();

  const skus = await prisma.sKU.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const rows = skus.map((item) => {
    const cost = item.cost.toNumber();
    const currentPrice = item.currentPrice.toNumber();
    return {
      id: item.id,
      title: item.title,
      sku: item.sku,
      cost,
      currentPrice,
      marginPercent: calcMarginPercent(cost, currentPrice),
      status: item.status,
    };
  });

  return (
    <>
      <section className="content-card page-intro">
        <div>
          <h2>SKUs</h2>
          <p>Manage workspace SKU catalog.</p>
        </div>
        <Link href="/skus/new" className="button-primary">
          Add SKU
        </Link>
      </section>
      <SkuTableClient items={rows} />
    </>
  );
}
