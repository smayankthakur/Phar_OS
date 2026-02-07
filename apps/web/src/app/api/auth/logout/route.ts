import { cookies } from "next/headers";
import { err, ok } from "@/lib/apiResponse";
import { clearCsrfCookie, clearSessionCookie, destroySessionByToken, getSession } from "@/lib/auth";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { clearClientDemoModeCookie } from "@/lib/demoMode";
import { prisma } from "@/lib/prisma";
import { logTelemetry } from "@/lib/telemetry";

export async function POST(request: Request) {
  try {
    await verifyCsrf(request);
    const session = await getSession();
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (session?.workspaceId) {
      await logTelemetry(prisma, session.workspaceId, "AUTH_LOGOUT", { userId: session.userId }).catch(() => undefined);
    }

    await destroySessionByToken(token);

    const response = ok({ loggedOut: true });
    clearSessionCookie(response);
    clearCsrfCookie(response);
    clearClientDemoModeCookie(response);
    response.cookies.set(CSRF_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
    return err("INTERNAL", "Failed to logout", 500);
  }
}
