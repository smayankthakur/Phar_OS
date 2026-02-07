"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Command Center" },
  { href: "/skus", label: "SKUs" },
  { href: "/rules", label: "Rules" },
  { href: "/competitors", label: "Competitors" },
  { href: "/billing", label: "Billing" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/import", label: "Import Center" },
  { href: "/portal", label: "Portal" },
  { href: "/reseller", label: "Reseller" },
  { href: "/integrations/shopify", label: "Shopify" },
  { href: "/integrations/notifications", label: "Notifications" },
  { href: "/ops", label: "Ops" },
  { href: "/settings", label: "Settings" },
  { href: "/help", label: "Help" },
  { href: "/demo", label: "Demo" },
];

export function SidebarNav({
  featureFlags,
}: {
  featureFlags: {
    portal: boolean;
    shopify: boolean;
    notifications: boolean;
    demoMode: boolean;
  };
}) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <nav>
        {NAV_ITEMS.map((item) => {
          const disabled =
            (item.href === "/portal" && !featureFlags.portal) ||
            (item.href.startsWith("/integrations/shopify") && !featureFlags.shopify) ||
            (item.href.startsWith("/integrations/notifications") && !featureFlags.notifications) ||
            (item.href === "/demo" && !featureFlags.demoMode);
          const active =
            item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return disabled ? (
            <span key={item.href} className="nav-link" title="Upgrade required">
              {item.label} (Locked)
            </span>
          ) : (
            <Link key={item.href} href={item.href} className={`nav-link ${active ? "active" : ""}`}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
