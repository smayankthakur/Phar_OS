import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSessionForApi } from "@/lib/auth";

export type ResellerAppRole = "RESELLER_OWNER" | "RESELLER_ADMIN" | "RESELLER_SUPPORT";

const ROLE_WEIGHT: Record<ResellerAppRole, number> = {
  RESELLER_SUPPORT: 1,
  RESELLER_ADMIN: 2,
  RESELLER_OWNER: 3,
};

export class ResellerAuthError extends Error {
  constructor(message: string, public status = 403) {
    super(message);
  }
}

export function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

export const domainSchema = z
  .string()
  .min(3)
  .max(255)
  .refine((value) => /^[a-z0-9.-]+$/.test(normalizeDomain(value)), "Invalid domain");

export async function getResellerMembershipForCurrentUser() {
  const session = await requireSessionForApi();
  const membership = await prisma.resellerMembership.findFirst({
    where: { userId: session.userId },
    select: {
      id: true,
      role: true,
      reseller: {
        select: {
          id: true,
          name: true,
          brandName: true,
          appName: true,
          logoUrl: true,
          accentColor: true,
          supportEmail: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) return null;

  return {
    resellerId: membership.reseller.id,
    role: membership.role as ResellerAppRole,
    reseller: membership.reseller,
    userId: session.userId,
    user: session.user,
  };
}

export async function requireResellerRole(minRole: ResellerAppRole) {
  const membership = await getResellerMembershipForCurrentUser();
  if (!membership) {
    throw new ResellerAuthError("Reseller membership required", 403);
  }
  if (ROLE_WEIGHT[membership.role] < ROLE_WEIGHT[minRole]) {
    throw new ResellerAuthError("Insufficient reseller permissions", 403);
  }
  return membership;
}

