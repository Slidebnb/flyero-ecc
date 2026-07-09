import Link from "next/link";
import type { ReactNode } from "react";
import {
  Bell,
  CircleHelp,
  CreditCard,
  FileStack,
  FileText,
  LayoutDashboard,
  ListChecks,
  Plus,
  ReceiptText,
  Settings,
} from "lucide-react";

type CustomerPortalShellProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  active?: string;
  children: ReactNode;
};

const navItems = [
  { href: "/customer/orders/new", label: "Neue Kampagne", icon: Plus },
  { href: "/customer/dashboard", label: "Übersicht", icon: LayoutDashboard },
  { href: "/customer/orders", label: "Kampagnen", icon: ListChecks },
  { href: "/customer/documents", label: "Dateien & Druck", icon: FileStack },
  { href: "/customer/payments", label: "Zahlungen", icon: CreditCard },
  { href: "/customer/invoices", label: "Rechnungen", icon: ReceiptText },
  { href: "/customer/reports", label: "Berichte", icon: FileText },
  { href: "/customer/notifications", label: "Nachrichten", icon: Bell },
  { href: "/customer/support", label: "Support", icon: CircleHelp },
  { href: "/customer/profile", label: "Einstellungen", icon: Settings },
];

function FlyeroDarkLogo() {
  return (
    <span className="flyeroLogo dark" aria-label="FLYERO">
      <span className="flyeroMark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <strong>FLYERO</strong>
    </span>
  );
}

export function CustomerPortalShell({
  title,
  eyebrow = "Kundenportal",
  description,
  active,
  children,
}: CustomerPortalShellProps) {
  return (
    <main className="customerUnifiedShell">
      <header className="customerUnifiedTopbar">
        <h1>{title}</h1>
        <span>{eyebrow}</span>
        <div className="orderTopActions" aria-label="Kontoaktionen">
          <Link href="/customer/notifications">Nachrichten</Link>
          <strong>Kundenkonto</strong>
        </div>
      </header>
      <div className="customerUnifiedBody">
        <aside className="orderSideNav customerSideNav" aria-label="Kundennavigation">
          <FlyeroDarkLogo />
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active === item.href ? "sideNavActive" : ""}
              >
                <span><Icon aria-hidden="true" /></span>
                {item.label}
              </Link>
            );
          })}
          <div className="sideNavFooter">
            <form action="/api/auth/logout" method="post">
              <button type="submit">Ausloggen</button>
            </form>
          </div>
        </aside>
        <section className="customerUnifiedContent">
          {description ? <p className="customerPageDescription">{description}</p> : null}
          {children}
        </section>
      </div>
    </main>
  );
}
