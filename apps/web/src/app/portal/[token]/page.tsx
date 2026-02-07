import { notFound } from "next/navigation";
import { PortalViewer } from "@/components/portal/PortalViewer";
import { getBrandingForRequest } from "@/lib/branding";
import { getWorkspaceByToken } from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { logTelemetry } from "@/lib/telemetry";
import { headers } from "next/headers";

export default async function PortalTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const access = await getWorkspaceByToken(token);

  if (!access) {
    notFound();
  }

  await logTelemetry(prisma, access.workspaceId, "PORTAL_VIEW", {
    tokenId: access.tokenId,
    path: `/portal/${token}`,
  });

  const host = (await headers()).get("host");
  const branding = await getBrandingForRequest({ host, workspaceId: access.workspaceId });

  return <PortalViewer token={token} initialWorkspaceName={access.workspace.name} branding={branding} />;
}
