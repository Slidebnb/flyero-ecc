import Link from "next/link";
import type { ReactNode } from "react";
import {
  CircleHelp,
  FileStack,
  FileText,
  LayoutDashboard,
  ListChecks,
  Plus,
  ReceiptText,
  UserCircle,
} from "lucide-react";

type CustomerPortalShellProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  active?: string;
  children: ReactNode;
};

const navItems = [
  { href: "/customer/dashboard", label: "Übersicht", icon: LayoutDashboard, group: "Start" },
  { href: "/customer/orders/new", label: "Neue Verteilung", icon: Plus, group: "Start" },
  { href: "/customer/orders", label: "Kampagnen", icon: ListChecks, group: "Start" },
  { href: "/customer/reports", label: "Nachweise", icon: FileText, group: "Ergebnisse" },
  { href: "/customer/invoices", label: "Rechnungen", icon: ReceiptText, group: "Ergebnisse" },
  { href: "/customer/documents", label: "Dateien", icon: FileStack, group: "Ergebnisse" },
  { href: "/customer/support", label: "Hilfe", icon: CircleHelp, group: "Hilfe" },
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
  const groups = Array.from(new Set(navItems.map((item) => item.group)));

  return (
    <main className="customerUnifiedShell">
      <header className="customerUnifiedTopbar">
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
        </div>
        <div className="orderTopActions" aria-label="Kontoaktionen">
          <Link className="topPrimaryAction" href="/customer/orders/new">Neue Verteilung</Link>
          <Link href="/customer/reports">Nachweise</Link>
          <Link href="/customer/support">Hilfe</Link>
          <Link href="/customer/profile" aria-label="Profil">
            <UserCircle aria-hidden="true" />
            Profil
          </Link>
        </div>
      </header>
      <div className="customerUnifiedBody">
        <aside className="orderSideNav customerSideNav" aria-label="Kundennavigation">
          <FlyeroDarkLogo />
          {groups.map((group) => (
            <div className="customerSideNavSection" key={group}>
              <small>{group}</small>
              {navItems.filter((item) => item.group === group).map((item) => {
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
            </div>
          ))}
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
