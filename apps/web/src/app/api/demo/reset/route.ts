import { err, ok } from "@/lib/apiResponse";
import { AuthError } from "@/lib/auth";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { EntitlementError, requireFeature } from "@/lib/entitlements";
import { getCurrentWorkspace } from "@/lib/tenant";
import { resetWorkspaceDemoDataset } from "@/lib/demoSeed";
import { prisma } from "@/lib/prisma";
import { RateLimitError, rateLimitOrThrow } from "@/lib/ratelimit";
import { requireOwner } from "@/lib/rbac";
import { logTelemetry } from "@/lib/telemetry";

export async function POST(request: Request) {
  try {
    await verifyCsrf(request);
    const { workspace } = await getCurrentWorkspace();
    await requireFeature(workspace.id, "demoMode");
    await requireOwner(workspace.id);
    try {
      await rateLimitOrThrow({
        route: "demo.reset",
        scopeKey: `ws:${workspace.id}`,
        limit: 10,
        windowSec: 60,
      });
    } catch (error) {
      if (error instanceof RateLimitError) return err("TOO_MANY_REQUESTS", error.message, 429);
    }
    const seeded = await resetWorkspaceDemoDataset(workspace.id);
    await logTelemetry(prisma, workspace.id, "DEMO_RESET", {
      skus: seeded.skusCount,
      competitors: seeded.competitorsCount,
      snapshots: seeded.snapshotsCount,
      rules: seeded.rulesCount,
    });

    return ok({
      workspaceId: workspace.id,
      seeded: {
        skus: seeded.skusCount,
        competitors: seeded.competitorsCount,
        snapshots: seeded.snapshotsCount,
        rules: seeded.rulesCount,
      },
    });
  } catch (error) {
    if (error instanceof CsrfError) {
      return err("CSRF_INVALID", error.message, 403);
    }
    if (error instanceof EntitlementError) {
      return err("FORBIDDEN", error.message, 403);
    }
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to reset demo dataset", 500);
  }
}
