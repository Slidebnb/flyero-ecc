import type { ReactNode } from "react";
import { PortalShell } from "@/app/PortalComponents";

const adminNavItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/orders", label: "Aufträge" },
  { href: "/admin/payments", label: "Zahlungen" },
  { href: "/admin/invoices", label: "Rechnungen" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/crm", label: "CRM" },
  { href: "/admin/dispatch", label: "Dispatch" },
  { href: "/admin/tours", label: "Touren" },
  { href: "/admin/warehouse", label: "Lager" },
  { href: "/admin/logistics", label: "Logistik" },
  { href: "/admin/distributors", label: "Verteiler" },
  { href: "/admin/documents", label: "Dokumente" },
  { href: "/admin/reports", label: "Berichte" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/monitoring", label: "Monitoring" },
  { href: "/admin/accounting", label: "Buchhaltung" },
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
