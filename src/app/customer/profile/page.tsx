import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { asObject } from "@/lib/format";

export default async function CustomerProfilePage() {
  const session = await requireRole([UserRole.CUSTOMER]);
  const profile = await prisma.customerProfile.findUnique({
    where: { userId: session.id },
    include: { user: true },
  });

  if (!profile) {
    return <main className="appShell">Kundenprofil wurde nicht gefunden.</main>;
  }

  const billing = asObject(profile.billingAddress);
  const delivery = asObject(profile.deliveryAddress);

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Kundenportal</p>
          <h1>Profil</h1>
        </div>
        <nav className="nav">
          <Link href="/customer/dashboard">Dashboard</Link>
        </nav>
      </header>

      <section className="panel">
        <form action="/api/customer/profile" method="post" className="form grid">
          <label>
            Firma
            <input name="companyName" defaultValue={profile.companyName} required />
          </label>
          <label>
            Ansprechpartner
            <input name="contactName" defaultValue={profile.contactName} required />
          </label>
          <label>
            E-Mail
            <input value={profile.user.email} disabled />
          </label>
          <label>
            Telefon
            <input name="phone" defaultValue={profile.phone} required />
          </label>
          <label>
            Rechnungsstraße
            <input name="billingStreet" defaultValue={String(billing.street || "")} required />
          </label>
          <label>
            Hausnummer
            <input name="billingHouseNumber" defaultValue={String(billing.houseNumber || "")} />
          </label>
          <label>
            PLZ
            <input name="billingPostalCode" defaultValue={String(billing.postalCode || "")} required />
          </label>
          <label>
            Stadt
            <input name="billingCity" defaultValue={String(billing.city || "")} required />
          </label>
          <label>
            Lieferstraße optional
            <input name="deliveryStreet" defaultValue={String(delivery.street || "")} />
          </label>
          <label>
            Liefer-Hausnummer optional
            <input name="deliveryHouseNumber" defaultValue={String(delivery.houseNumber || "")} />
          </label>
          <label>
            Liefer-PLZ optional
            <input name="deliveryPostalCode" defaultValue={String(delivery.postalCode || "")} />
          </label>
          <label>
            Lieferstadt optional
            <input name="deliveryCity" defaultValue={String(delivery.city || "")} />
          </label>
          <label>
            USt-ID optional
            <input name="vatId" defaultValue={profile.vatId || ""} />
          </label>
          <label>
            Logo-URL optional
            <input name="logoUrl" type="url" defaultValue={profile.logoUrl || ""} />
          </label>
          <label>
            Aktuelles Passwort
            <input name="currentPassword" type="password" autoComplete="current-password" />
          </label>
          <label>
            Neues Passwort
            <input name="newPassword" type="password" autoComplete="new-password" minLength={10} />
          </label>
          <button type="submit">Profil speichern</button>
        </form>
      </section>
    </main>
  );
}
