import { cookies } from "next/headers";
import { CSRF_COOKIE_NAME } from "@/lib/auth-constants";

export const CSRF_HEADER_NAME = "x-pharos-csrf";

export class CsrfError extends Error {
  constructor(message = "CSRF token missing or invalid") {
    super(message);
  }
}

function isMutatingMethod(method: string) {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

export async function getCsrfTokenFromCookies() {
  const store = await cookies();
  return store.get(CSRF_COOKIE_NAME)?.value ?? null;
}

export async function verifyCsrf(request: Request) {
  if (!isMutatingMethod(request.method)) return;

  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  const cookieToken = await getCsrfTokenFromCookies();

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    throw new CsrfError();
  }
}

