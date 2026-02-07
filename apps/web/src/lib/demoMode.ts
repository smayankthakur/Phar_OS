import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const CLIENT_DEMO_COOKIE_NAME = "pharos_demo";
const CLIENT_DEMO_MAX_AGE = 60 * 60 * 24 * 7;

export async function isClientDemoMode() {
  const cookieStore = await cookies();
  return cookieStore.get(CLIENT_DEMO_COOKIE_NAME)?.value === "1";
}

export function setClientDemoModeCookie(response: NextResponse) {
  response.cookies.set(CLIENT_DEMO_COOKIE_NAME, "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: CLIENT_DEMO_MAX_AGE,
  });
}

export function clearClientDemoModeCookie(response: NextResponse) {
  response.cookies.set(CLIENT_DEMO_COOKIE_NAME, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  });
}
