import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { createSession, generateCsrfToken, hashPassword, isSetupRequired, setCsrfCookie, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logTelemetry } from "@/lib/telemetry";
import { ensureDefaultRules, setWorkspaceCookie } from "@/lib/tenant";
import { ensureWorkspaceSubscription } from "@/lib/plans";
import { ensureWorkspaceSettings } from "@/lib/settings";
import { ensureWorkspaceShopifySettings } from "@/lib/shopifyClient";
import { ensureWorkspaceNotificationSettings } from "@/lib/notify";

const setupSchema = z.object({
  workspaceName: z.string().trim().min(3).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const required = await isSetupRequired();
  if (!required) {
    return err("CONFLICT", "Setup already completed", 409);
  }

  let payload: z.infer<typeof setupSchema>;
  try {
    payload = setupSchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid setup payload", 400);
  }

  try {
    const passwordHash = await hashPassword(payload.password);
    const email = payload.email.trim().toLowerCase();

    const created = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: payload.workspaceName,
        },
        select: { id: true, name: true },
      });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: "Owner",
        },
        select: { id: true, email: true },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: "OWNER",
        },
      });

      return { workspace, user };
    });

    await ensureDefaultRules(created.workspace.id);
    await ensureWorkspaceSubscription(created.workspace.id);
    await ensureWorkspaceSettings(created.workspace.id);
    await ensureWorkspaceShopifySettings(created.workspace.id);
    await ensureWorkspaceNotificationSettings(created.workspace.id);

    const { token, expiresAt } = await createSession(created.user.id, created.workspace.id);
    await logTelemetry(prisma, created.workspace.id, "AUTH_LOGIN_SUCCESS", { userId: created.user.id }).catch(() => undefined);

    const response = ok({
      workspace: created.workspace,
      user: created.user,
    }, 201);

    setSessionCookie(response, token, expiresAt);
    setCsrfCookie(response, generateCsrfToken(), expiresAt);
    setWorkspaceCookie(response, created.workspace.id);

    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return err("CONFLICT", "Email already exists", 409);
    }
    return err("INTERNAL", "Failed to complete setup", 500);
  }
}
