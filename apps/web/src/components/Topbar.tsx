import Image from "next/image";
import { ExitDemoButton } from "@/components/ExitDemoButton";
import { LogoutButton } from "@/components/LogoutButton";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import type { Branding } from "@/lib/branding";

export async function Topbar({
  currentWorkspaceId,
  clientDemoMode,
  userEmail,
  role,
  workspaceName,
  branding,
}: {
  currentWorkspaceId: string;
  clientDemoMode: boolean;
  userEmail: string;
  role: "OWNER" | "ANALYST";
  workspaceName: string;
  branding: Branding;
}) {
  const name = branding.appName || "PharOS";
  const logoUrl = branding.logoUrl;
  return (
    <header className="topbar">
      <div className="logo">
        {logoUrl ? (
          // Avoid Next Image remote config complexity for MVP.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={name} width={28} height={28} className="logo-mark" />
        ) : (
          <Image src="/logo.png" alt={name} width={28} height={28} className="logo-mark" />
        )}
        <span>{name}</span>
      </div>
      <WorkspaceSwitcher currentWorkspaceId={currentWorkspaceId} />
      <div className="row-actions">
        <span className="badge">DEMO</span>
        {clientDemoMode ? <span className="badge badge-client">CLIENT DEMO MODE</span> : null}
        <span className="badge">{role}</span>
        <span className="badge">{userEmail}</span>
        <span className="badge">{workspaceName}</span>
        {clientDemoMode ? <ExitDemoButton /> : null}
        <LogoutButton />
      </div>
    </header>
  );
}
