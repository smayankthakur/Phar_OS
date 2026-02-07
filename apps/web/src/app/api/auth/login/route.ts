import { z } from "zod";
import { err, ok } from "@/lib/apiResponse";
import { createSession, generateCsrfToken, setCsrfCookie, setSessionCookie, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RateLimitError, getClientIp, rateLimitOrThrow } from "@/lib/ratelimit";
import { logTelemetry } from "@/lib/telemetry";
import { setWorkspaceCookie } from "@/lib/tenant";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    await rateLimitOrThrow({
      route: "auth.login",
      scopeKey: `ip:${getClientIp(request)}`,
      limit: 10,
      windowSec: 60,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return err("TOO_MANY_REQUESTS", error.message, 429);
  }

  let payload: z.infer<typeof loginSchema>;
  try {
    payload = loginSchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid login payload", 400);
  }

  const email = payload.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: { workspaceId: true },
      },
    },
  });

  if (!user?.passwordHash || !(await verifyPassword(payload.password, user.passwordHash))) {
    if (user?.memberships[0]?.workspaceId) {
      await logTelemetry(prisma, user.memberships[0].workspaceId, "AUTH_LOGIN_FAILED", { email }).catch(() => undefined);
    }
    return err("UNAUTHORIZED", "Invalid email or password", 401);
  }

  const workspaceId = user.memberships[0]?.workspaceId;
  if (!workspaceId) {
    return err("FORBIDDEN", "No workspace membership found", 403);
  }

  const { token, expiresAt } = await createSession(user.id, workspaceId);

  await logTelemetry(prisma, workspaceId, "AUTH_LOGIN_SUCCESS", { userId: user.id }).catch(() => undefined);

  const response = ok({ user: { id: user.id, email: user.email }, workspaceId });
  setSessionCookie(response, token, expiresAt);
  setCsrfCookie(response, generateCsrfToken(), expiresAt);
  setWorkspaceCookie(response, workspaceId);
  return response;
}
