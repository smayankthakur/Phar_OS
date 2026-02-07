export const CSRF_HEADER_NAME = "x-pharos-csrf";

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part.startsWith(`${name}=`)) continue;
    return decodeURIComponent(part.slice(name.length + 1));
  }
  return null;
}

export function getCsrfTokenFromDocument() {
  return readCookie("pharos_csrf");
}

export function withCsrfHeaders(headers: HeadersInit = {}) {
  const token = getCsrfTokenFromDocument();
  if (!token) return headers;
  return { ...headers, [CSRF_HEADER_NAME]: token };
}

