import { err, ok } from "@/lib/apiResponse";
import { getPricingSettings } from "@/lib/settings";
import { getWorkspaceByToken } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const access = await getWorkspaceByToken(token);
  if (!access) {
    return err("NOT_FOUND", "Portal not found", 404);
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [settings, skus, competitors, signals7d, recommendedOpen, applied7d] = await Promise.all([
    getPricingSettings(access.workspaceId),
    prisma.sKU.count({ where: { workspaceId: access.workspaceId } }),
    prisma.competitor.count({ where: { workspaceId: access.workspaceId } }),
    prisma.event.count({ where: { workspaceId: access.workspaceId, createdAt: { gte: sevenDaysAgo } } }),
    prisma.action.count({ where: { workspaceId: access.workspaceId, status: "RECOMMENDED" } }),
    prisma.action.count({ where: { workspaceId: access.workspaceId, status: "APPLIED", appliedAt: { gte: sevenDaysAgo } } }),
  ]);

  return ok({
    workspace: {
      name: access.workspace.name,
    },
    settings,
    counts: {
      skus,
      competitors,
      signals7d,
      recommendedOpen,
      applied7d,
    },
  });
}
