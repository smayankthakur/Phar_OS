import { prisma } from "@/lib/prisma";

export type Branding = {
  brandName: string;
  appName: string;
  logoUrl: string | null;
  accentColor: string | null;
  supportEmail: string | null;
  resellerId: string | null;
};

function stripPort(host: string | null | undefined) {
  if (!host) return null;
  const trimmed = host.trim().toLowerCase();
  if (!trimmed) return null;
  // Handles "example.com:3000"
  const idx = trimmed.indexOf(":");
  return idx >= 0 ? trimmed.slice(0, idx) : trimmed;
}

function defaultBranding(): Branding {
  return {
    brandName: "PharOS",
    appName: "PharOS",
    logoUrl: null,
    accentColor: null,
    supportEmail: null,
    resellerId: null,
  };
}

export async function getResellerByHost(host: string | null | undefined) {
  const domain = stripPort(host);
  if (!domain) return null;

  const mapping = await prisma.resellerDomain.findFirst({
    where: { domain, verifiedAt: { not: null } },
    select: {
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
  });

  return mapping?.reseller ?? null;
}

export async function getBrandingForWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
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
  });

  return workspace?.reseller ?? null;
}

export async function getBrandingForRequest(input: { host?: string | null; workspaceId?: string | null }): Promise<Branding> {
  const byHost = input.host ? await getResellerByHost(input.host) : null;
  if (byHost) {
    return {
      brandName: byHost.brandName ?? byHost.name,
      appName: byHost.appName ?? byHost.brandName ?? byHost.name,
      logoUrl: byHost.logoUrl ?? null,
      accentColor: byHost.accentColor ?? null,
      supportEmail: byHost.supportEmail ?? null,
      resellerId: byHost.id,
    };
  }

  if (input.workspaceId) {
    const byWorkspace = await getBrandingForWorkspace(input.workspaceId);
    if (byWorkspace) {
      return {
        brandName: byWorkspace.brandName ?? byWorkspace.name,
        appName: byWorkspace.appName ?? byWorkspace.brandName ?? byWorkspace.name,
        logoUrl: byWorkspace.logoUrl ?? null,
        accentColor: byWorkspace.accentColor ?? null,
        supportEmail: byWorkspace.supportEmail ?? null,
        resellerId: byWorkspace.id,
      };
    }
  }

  return defaultBranding();
}

