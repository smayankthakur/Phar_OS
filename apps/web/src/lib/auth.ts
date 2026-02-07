import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth-constants";

export class AuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
  }
}

export type SessionContext = {
  id: string;
  userId: string;
  workspaceId: string | null;
  expiresAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
};

function sessionExpired(expiresAt: Date) {
  return expiresAt.getTime() <= Date.now();
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function generateCsrfToken() {
  return randomBytes(24).toString("base64url");
}

export async function createSession(userId: string, workspaceId?: string | null) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await prisma.session.create({
    data: {
      userId,
      workspaceId: workspaceId ?? null,
      token,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    maxAge,
  });
}

export function setCsrfCookie(response: NextResponse, token: string, expiresAt: Date) {
  const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: isProduction(),
    maxAge,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    maxAge: 0,
  });
}

export function clearCsrfCookie(response: NextResponse) {
  response.cookies.set(CSRF_COOKIE_NAME, "", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: isProduction(),
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!session) return null;

  if (sessionExpired(session.expiresAt)) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return {
    id: session.id,
    userId: session.userId,
    workspaceId: session.workspaceId,
    expiresAt: session.expiresAt,
    user: session.user,
  };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireSessionForApi() {
  const session = await getSession();
  if (!session) {
    throw new AuthError("Authentication required", 401);
  }
  return session;
}

export async function destroySessionByToken(token: string | undefined) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { token } });
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await destroySessionByToken(token);
  }
}

export async function isSetupRequired() {
  const configuredUsersCount = await prisma.user.count({
    where: {
      passwordHash: {
        not: null,
      },
    },
  });
  return configuredUsersCount === 0;
}
