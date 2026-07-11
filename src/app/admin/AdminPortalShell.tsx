import type { ReactNode } from "react";
import { PortalShell } from "@/app/PortalComponents";

export const adminNavItems = [
  { href: "/admin/dashboard", label: "Übersicht" },
  { href: "/admin/orders", label: "Aufträge" },
  { href: "/admin/dispatch", label: "Dispatch" },
  { href: "/admin/reports", label: "Nachweise" },
  { href: "/admin/leads", label: "Leads & CRM" },
  { href: "/admin/warehouse", label: "Lager" },
  { href: "/admin/logistics", label: "Logistik" },
  { href: "/admin/distributors", label: "Verteiler" },
  { href: "/admin/documents", label: "Dokumente" },
  { href: "/admin/accounting", label: "Abrechnung" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/settings", label: "Einstellungen" },
];

export function AdminPortalShell({
  title,
  eyebrow = "Adminbereich",
  description,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <PortalShell eyebrow={eyebrow} title={title} description={description} navItems={adminNavItems}>
      {children}
    </PortalShell>
  );
}
