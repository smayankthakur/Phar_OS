"use client";

import { usePathname } from "next/navigation";

function pageTitle(pathname: string) {
  if (pathname === "/") return "Command Center";
  if (pathname.startsWith("/skus")) return "SKUs";
  if (pathname.startsWith("/rules")) return "Rules";
  if (pathname.startsWith("/competitors")) return "Competitors";
  if (pathname.startsWith("/billing")) return "Billing";
  if (pathname.startsWith("/onboarding")) return "Onboarding";
  if (pathname.startsWith("/import")) return "Import Center";
  if (pathname === "/portal") return "Portal";
  if (pathname.startsWith("/integrations/shopify")) return "Shopify Integration";
  if (pathname.startsWith("/integrations/notifications")) return "Notifications Integration";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/help")) return "Help";
  if (pathname.startsWith("/demo")) return "Demo";
  return "PharOS";
}

export function PageHeaderClient({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();
  const title = pageTitle(pathname);
  const crumb = pathname === "/" ? "Home / Command Center" : `Home${pathname}`;

  return (
    <div className="page-header">
      <h1 className="page-title">{title}</h1>
      <p className="breadcrumb">
        {workspaceName} | {crumb}
      </p>
    </div>
  );
}
