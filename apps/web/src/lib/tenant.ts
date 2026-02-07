import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireSessionForApi } from "@/lib/auth";
import { ensureWorkspaceNotificationSettings } from "@/lib/notify";
import { ensureWorkspaceSubscription } from "@/lib/plans";
import { ensureWorkspaceSettings } from "@/lib/settings";
import { ensureWorkspaceShopifySettings } from "@/lib/shopifyClient";

export const WORKSPACE_COOKIE_NAME = "pharos_ws";
const DEMO_WORKSPACE_NAME = "PharOS Demo Workspace";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function ensureDefaultRules(workspaceId: string) {
  const defaults = [
    {
      name: "Rule A - Competitor Price Drop -> Price Match",
      eventType: "COMPETITOR_PRICE_DROP",
      condition: {
        op: "lt",
        left: "payload.newPrice",
        right: "sku.currentPrice",
      },
      actionTemplate: {
        type: "PRICE_MATCH",
        params: {},
      },
    },
    {
      name: "Rule B - Cost Increase -> Price Increase",
      eventType: "COST_INCREASE",
      condition: {
        op: "gt",
        left: "payload.newCost",
        right: "payload.oldCost",
      },
      actionTemplate: {
        type: "PRICE_INCREASE",
        params: {},
      },
    },
    {
      name: "Rule C - Stock Low -> Notify",
      eventType: "STOCK_LOW",
      condition: {
        op: "lt",
        left: "payload.available",
        right: "payload.threshold",
      },
      actionTemplate: {
        type: "NOTIFY",
        params: {},
      },
    },
  ] as const;

  for (const rule of defaults) {
    await prisma.rule.upsert({
      where: {
        workspaceId_name: {
          workspaceId,
          name: rule.name,
        },
      },
      create: {
        workspaceId,
        name: rule.name,
        eventType: rule.eventType,
        enabled: true,
        condition: rule.condition,
        actionTemplate: rule.actionTemplate,
      },
      update: {
        eventType: rule.eventType,
        condition: rule.condition,
        actionTemplate: rule.actionTemplate,
      },
    });
  }
}

async function ensureWorkspaceDependencies(workspaceId: string) {
  await ensureDefaultRules(workspaceId);
  await ensureWorkspaceSubscription(workspaceId);
  await ensureWorkspaceSettings(workspaceId);
  await ensureWorkspaceShopifySettings(workspaceId);
  await ensureWorkspaceNotificationSettings(workspaceId);
}

export async function getOrCreateDefaultWorkspace() {
  let workspace = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: DEMO_WORKSPACE_NAME,
      },
    });
  }

  await ensureWorkspaceDependencies(workspace.id);
  return workspace;
}

export async function getWorkspaceMembershipsForCurrentUser(userId?: string) {
  const resolvedUserId = userId ?? (await requireSessionForApi()).userId;
  return prisma.membership.findMany({
    where: { userId: resolvedUserId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function getCurrentWorkspace() {
  const session = await requireSessionForApi();
  const memberships = await getWorkspaceMembershipsForCurrentUser(session.userId);

  if (memberships.length === 0) {
    throw new AuthError("No workspace membership found", 403);
  }

  const cookieStore = await cookies();
  const workspaceIdFromCookie = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value;

  let target = memberships.find((membership) => membership.workspace.id === workspaceIdFromCookie);
  let needsCookieSync = false;

  if (!target) {
    target = memberships[0];
    needsCookieSync = true;
  }

  await ensureWorkspaceDependencies(target.workspace.id);

  if (session.workspaceId !== target.workspace.id) {
    await prisma.session.update({
      where: { id: session.id },
      data: { workspaceId: target.workspace.id },
    });
  }

  return {
    workspace: target.workspace,
    role: target.role,
    memberships,
    needsCookieSync,
  };
}

export function setWorkspaceCookie(response: NextResponse, workspaceId: string) {
  const isProduction = process.env.NODE_ENV === "production";
  response.cookies.set(WORKSPACE_COOKIE_NAME, workspaceId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: COOKIE_MAX_AGE,
  });
}
