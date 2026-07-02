import Link from "next/link";
import type { ReactNode } from "react";

type CustomerPortalShellProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  active?: string;
  children: ReactNode;
};

const navItems = [
  { href: "/customer/orders/new", label: "Neue Bestellung", icon: "+" },
  { href: "/customer/dashboard", label: "Dashboard", icon: "D" },
  { href: "/customer/orders", label: "Bestellungen", icon: "B" },
  { href: "/customer/documents", label: "Dokumente", icon: "F" },
  { href: "/customer/payments", label: "Zahlungen", icon: "EUR" },
  { href: "/customer/invoices", label: "Rechnungen", icon: "R" },
  { href: "/customer/reports", label: "Berichte", icon: "P" },
  { href: "/customer/notifications", label: "Nachrichten", icon: "!" },
  { href: "/customer/support", label: "Support", icon: "?" },
  { href: "/customer/profile", label: "Einstellungen", icon: "*" },
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
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={active === item.href ? "sideNavActive" : ""}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
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
