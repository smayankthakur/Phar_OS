import { randomBytes } from "node:crypto";
import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { AuthError, hashPassword } from "@/lib/auth";
import { EntitlementError, requireWithinLimit } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/rbac";
import { recalcUsage } from "@/lib/usage";
import { getCurrentWorkspace } from "@/lib/tenant";

const createSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "ANALYST"]),
});

function tempPassword() {
  return `Temp#${randomBytes(8).toString("hex")}`;
}

export async function GET() {
  const { workspace } = await getCurrentWorkspace();
  const memberships = await prisma.membership.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  return ok({
    items: memberships.map((m) => ({
      id: m.id,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
      user: m.user,
    })),
  });
}

export async function POST(request: Request) {
  const { workspace } = await getCurrentWorkspace();

  try {
    await requireOwner(workspace.id);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 403) return err("FORBIDDEN", "Insufficient permissions", 403);
      return err("UNAUTHORIZED", "Authentication required", 401);
    }
    return err("INTERNAL", "Failed to authorize membership creation", 500);
  }

  let payload: z.infer<typeof createSchema>;
  try {
    payload = createSchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid membership payload", 400);
  }

  const email = payload.email.trim().toLowerCase();

  try {
    const existingMembership = await prisma.membership.findFirst({
      where: {
        workspaceId: workspace.id,
        user: {
          email,
        },
      },
      select: { id: true },
    });

    if (!existingMembership) {
      await requireWithinLimit(workspace.id, "seats", 1);
    }

    const result = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { email },
        select: { id: true, email: true },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            passwordHash: await hashPassword(tempPassword()),
            name: email.split("@")[0],
          },
          select: { id: true, email: true },
        });
      }

      const membership = await tx.membership.upsert({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId: workspace.id,
          },
        },
        create: {
          userId: user.id,
          workspaceId: workspace.id,
          role: payload.role,
        },
        update: {
          role: payload.role,
        },
        select: {
          id: true,
          role: true,
          createdAt: true,
        },
      });

      return { user, membership };
    });

    await recalcUsage(workspace.id);

    return ok(
      {
        item: {
          id: result.membership.id,
          role: result.membership.role,
          createdAt: result.membership.createdAt.toISOString(),
          user: result.user,
        },
      },
      201,
    );
  } catch (error) {
    if (error instanceof EntitlementError) {
      return err("FORBIDDEN", error.message, 403);
    }
    return err("INTERNAL", "Failed to create membership", 500);
  }
}
