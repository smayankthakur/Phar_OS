import { prisma } from "@/lib/prisma";

export function currentYearMonth(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getOrCreateUsage(workspaceId: string, yearMonth = currentYearMonth()) {
  return prisma.workspaceUsageMonth.upsert({
    where: {
      workspaceId_yearMonth: {
        workspaceId,
        yearMonth,
      },
    },
    create: {
      workspaceId,
      yearMonth,
    },
    update: {},
  });
}

export async function recalcUsage(workspaceId: string, yearMonth = currentYearMonth()) {
  const [seatsUsed, skusUsed, competitorsUsed, portalTokensUsed, usage] = await Promise.all([
    prisma.membership.count({ where: { workspaceId } }),
    prisma.sKU.count({ where: { workspaceId } }),
    prisma.competitor.count({ where: { workspaceId } }),
    prisma.portalToken.count({ where: { workspaceId, revokedAt: null } }),
    getOrCreateUsage(workspaceId, yearMonth),
  ]);

  return prisma.workspaceUsageMonth.update({
    where: { id: usage.id },
    data: {
      seatsUsed,
      skusUsed,
      competitorsUsed,
      portalTokensUsed,
    },
  });
}

export async function incrementSnapshotRows(workspaceId: string, rows: number, yearMonth = currentYearMonth()) {
  const usage = await getOrCreateUsage(workspaceId, yearMonth);
  return prisma.workspaceUsageMonth.update({
    where: { id: usage.id },
    data: {
      snapshotImportRowsUsed: {
        increment: rows,
      },
    },
  });
}
