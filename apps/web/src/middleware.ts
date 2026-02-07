import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

const PUBLIC_PAGE_PREFIXES = ["/client-demo", "/login", "/setup"];
const PUBLIC_API_PREFIXES = ["/api/portal/", "/api/templates/", "/api/auth/", "/api/cron/"];
const PUBLIC_API_EXACT = new Set(["/api/health"]);
const REQUEST_ID_HEADER = "x-request-id";

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

function requestIdFromRequest(request: NextRequest) {
  return request.headers.get(REQUEST_ID_HEADER) ?? "";
}

function ensureRequestId(request: NextRequest) {
  const existing = requestIdFromRequest(request);
  if (existing) return existing;
  return crypto.randomUUID();
}

function nextWithRequestId(request: NextRequest, init?: Parameters<typeof NextResponse.next>[0]) {
  const requestId = ensureRequestId(request);
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  const response = NextResponse.next({
    ...(init ?? {}),
    request: { headers },
  });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

function jsonWithRequestId(request: NextRequest, body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const requestId = ensureRequestId(request);
  const response = NextResponse.json(body, init);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

function redirectWithRequestId(request: NextRequest, url: URL) {
  const requestId = ensureRequestId(request);
  const response = NextResponse.redirect(url);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname)) {
      return nextWithRequestId(request);
    }

    if (!sessionCookie) {
      return jsonWithRequestId(
        request,
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

    return nextWithRequestId(request);
  }

  if (isPublicPage(pathname)) {
    if ((pathname === "/login" || pathname === "/setup") && sessionCookie) {
      return redirectWithRequestId(request, new URL("/", request.url));
    }
    return nextWithRequestId(request);
  }

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return redirectWithRequestId(request, loginUrl);
  }

  return nextWithRequestId(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
