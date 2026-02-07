import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { requireCron } from "@/lib/cron";
import { EntitlementError, requireBillingWriteAccess, requireFeature } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { processShopifyJobs } from "@/lib/shopifyJobs";

const bodySchema = z.object({
  workspaceId: z.string().optional(),
  perWorkspaceLimit: z.number().int().min(1).max(50).default(5).optional(),
  maxWorkspaces: z.number().int().min(1).max(200).default(50).optional(),
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

  const perWorkspaceLimit = payload.perWorkspaceLimit ?? 5;
  const processed: Array<{ workspaceId: string; jobs: Array<{ jobId: string; status: string; message?: string }> }> = [];

  const workspaceIds = payload.workspaceId
    ? [payload.workspaceId]
    : (
        await prisma.shopifyJob.findMany({
          where: { status: "QUEUED" },
          distinct: ["workspaceId"],
          select: { workspaceId: true },
          take: payload.maxWorkspaces ?? 50,
        })
      ).map((row) => row.workspaceId);

  for (const workspaceId of workspaceIds) {
    try {
      await requireFeature(workspaceId, "shopify");
      await requireBillingWriteAccess(workspaceId, "cron_shopify_job_process");
    } catch (error) {
      if (error instanceof EntitlementError) {
        // Skip workspaces that are not entitled to process Shopify jobs.
        continue;
      }
      continue;
    }

    const jobs = await processShopifyJobs(workspaceId, perWorkspaceLimit);
    if (jobs.length > 0) {
      processed.push({ workspaceId, jobs });
    }
  }

  return ok({ processed });
}

