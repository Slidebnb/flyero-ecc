import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";

const items = [
  ["Firma", "/admin/settings/company", "Stammdaten, Adresse, Steuern, Bank"],
  ["Branding", "/admin/settings/branding", "Farben, Logo und PDF-Footer"],
  ["Preise", "/admin/settings/pricing", "Preisregeln und Zuschlaege"],
  ["Nummernkreise", "/admin/settings/numbering", "Rechnung, Bericht und Auftrag"],
  ["Lager", "/admin/settings/warehouses", "Standorte, Standardlager, Kontakte"],
  ["Zahlungen", "/admin/settings/payments", "Stripe ENV Status"],
  ["Karten", "/admin/settings/maps", "Google Maps ENV Status"],
  ["Benutzer", "/admin/settings/users", "Interne Rollen und Status"],
];

export default async function AdminSettingsPage() {
  await requireRole([UserRole.ADMIN]);

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Adminbereich</p>
          <h1>Einstellungen</h1>
        </div>
        <nav className="nav">
          <Link href="/admin/dashboard">Dashboard</Link>
          <Link href="/admin/orders">Auftraege</Link>
        </nav>
      </header>
      <section className="gridCards">
        {items.map(([title, href, text]) => (
          <Link className="card" href={href} key={href}>
            <strong>{title}</strong>
            <span>{text}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
