import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/apiResponse";
import { EntitlementError, requireWithinLimit } from "@/lib/entitlements";
import { getCurrentWorkspace } from "@/lib/tenant";
import { createCompetitorSchema, isUniqueError, toCompetitorDTO } from "@/lib/competitors";

export async function GET() {
  const { workspace } = await getCurrentWorkspace();

  const competitors = await prisma.competitor.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" },
  });

  return ok({ items: competitors.map(toCompetitorDTO) });
}

export async function POST(request: Request) {
  const { workspace } = await getCurrentWorkspace();
  let payload;
  try {
    payload = createCompetitorSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return err("BAD_REQUEST", "Invalid competitor payload", 400);
    }
    return err("BAD_REQUEST", "Invalid request body", 400);
  }

  try {
    await requireWithinLimit(workspace.id, "competitors", 1);
    const competitor = await prisma.competitor.create({
      data: {
        workspaceId: workspace.id,
        name: payload.name,
        domain: payload.domain || null,
        currency: payload.currency?.toUpperCase() ?? "INR",
      },
    });

    return ok({ item: toCompetitorDTO(competitor) }, 201);
  } catch (error) {
    if (error instanceof EntitlementError) {
      return err("FORBIDDEN", error.message, 403);
    }
    if (isUniqueError(error)) {
      return err("CONFLICT", "Competitor name already exists in this workspace", 409);
    }
    return err("INTERNAL", "Failed to create competitor", 500);
  }
}
