import { ZodError } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireSessionForApi } from "@/lib/auth";
import { err, ok } from "@/lib/apiResponse";
import { setWorkspaceCookie } from "@/lib/tenant";
import { selectWorkspaceSchema } from "@/lib/validation";

async function extractWorkspaceId(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    return selectWorkspaceSchema.parse(body).workspaceId;
  }

  const formData = await request.formData();
  return selectWorkspaceSchema.parse({ workspaceId: formData.get("workspaceId") }).workspaceId;
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSessionForApi();
  } catch (error) {
    if (error instanceof AuthError) {
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authenticate workspace selection", 500);
  }
  let workspaceId: string;
  try {
    workspaceId = await extractWorkspaceId(request);
  } catch (error) {
    if (error instanceof ZodError) {
      return err("BAD_REQUEST", "Invalid workspaceId", 400);
    }
    return err("BAD_REQUEST", "Invalid workspace selection payload", 400);
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: session.userId,
        workspaceId,
      },
    },
    select: { id: true },
  });

  if (!membership) return err("NOT_FOUND", "Workspace not found", 404);

  await prisma.session.update({
    where: { id: session.id },
    data: { workspaceId },
  }).catch(() => undefined);

  const response = ok({});
  setWorkspaceCookie(response, workspaceId);
  return response as NextResponse;
}
