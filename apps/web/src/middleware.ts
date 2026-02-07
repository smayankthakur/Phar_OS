import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

const PUBLIC_PAGE_PREFIXES = ["/client-demo", "/login", "/setup"];
const PUBLIC_API_PREFIXES = ["/api/portal/", "/api/templates/", "/api/auth/", "/api/cron/"];
const PUBLIC_API_EXACT = new Set(["/api/health"]);

function isPublicPage(pathname: string) {
  if (PUBLIC_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  if (pathname.startsWith("/portal/")) {
    const segments = pathname.split("/").filter(Boolean);
    return segments.length === 2;
  }

  return false;
}

function isPublicApi(pathname: string) {
  if (pathname === "/api/stripe/webhook") return true;
  if (PUBLIC_API_EXACT.has(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname)) {
      return NextResponse.next();
    }

    if (!sessionCookie) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        { status: 401 },
      );
    }

    return NextResponse.next();
  }

  if (isPublicPage(pathname)) {
    if ((pathname === "/login" || pathname === "/setup") && sessionCookie) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
