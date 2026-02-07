import { calcMarginPercent } from "@pharos/core";
import { err, ok } from "@/lib/apiResponse";
import { getWorkspaceByToken } from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { getPricingSettings } from "@/lib/settings";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const access = await getWorkspaceByToken(token);
  if (!access) {
    return err("NOT_FOUND", "Portal not found", 404);
  }

  const settings = await getPricingSettings(access.workspaceId);

  const skus = await prisma.sKU.findMany({
    where: { workspaceId: access.workspaceId },
    orderBy: { createdAt: "asc" },
    select: {
      sku: true,
      title: true,
      cost: true,
      currentPrice: true,
    },
  });

  return ok({
    minMarginPercent: settings.minMarginPercent,
    items: skus.map((sku) => {
      const cost = sku.cost.toNumber();
      const price = sku.currentPrice.toNumber();
      const marginPercent = calcMarginPercent(cost, price);
      return {
        sku: sku.sku,
        title: sku.title,
        cost,
        currentPrice: price,
        marginPercent,
        belowMin: marginPercent < settings.minMarginPercent,
      };
    }),
  });
}
