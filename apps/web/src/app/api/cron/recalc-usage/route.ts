import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { requireCron } from "@/lib/cron";
import { currentYearMonth, recalcUsage } from "@/lib/usage";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  workspaceId: z.string().optional(),
  yearMonth: z.string().regex(/^\\d{4}-\\d{2}$/).optional(),
  maxWorkspaces: z.number().int().min(1).max(500).default(200).optional(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cronError = requireCron(request);
  if (cronError) return cronError;

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json().catch(() => ({})));
  } catch {
    return err("BAD_REQUEST", "Invalid cron payload", 400);
  }

  const yearMonth = payload.yearMonth ?? currentYearMonth();
  const workspaceIds = payload.workspaceId
    ? [payload.workspaceId]
    : (
        await prisma.workspace.findMany({
          select: { id: true },
          orderBy: { createdAt: "asc" },
          take: payload.maxWorkspaces ?? 200,
        })
      ).map((row) => row.id);

  const recalced: Array<{ workspaceId: string; yearMonth: string; seatsUsed: number; skusUsed: number; competitorsUsed: number }> = [];

  for (const workspaceId of workspaceIds) {
    const usage = await recalcUsage(workspaceId, yearMonth);
    recalced.push({
      workspaceId,
      yearMonth,
      seatsUsed: usage.seatsUsed,
      skusUsed: usage.skusUsed,
      competitorsUsed: usage.competitorsUsed,
    });
  }

  return ok({ yearMonth, workspaces: recalced.length, recalced });
}

