import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { ActionPanel, EmptyState } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { asObject } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function CustomerProfilePage() {
  const session = await requireRole([UserRole.CUSTOMER]);
  const profile = await prisma.customerProfile.findUnique({
    where: { userId: session.id },
    include: { user: true },
  });

  if (!profile) {
    return (
      <CustomerPortalShell active="/customer/profile" title="Einstellungen" description="Kontodaten, Rechnungsadresse und Sicherheit verwalten.">
        <EmptyState title="Kundenprofil wurde nicht gefunden." description="Bitte melden Sie sich erneut an oder kontaktieren Sie den Support." />
      </CustomerPortalShell>
    );
  }

  const billing = asObject(profile.billingAddress);
  const delivery = asObject(profile.deliveryAddress);

  return (
    <CustomerPortalShell active="/customer/profile" title="Einstellungen" description="Kontodaten, Rechnungsadresse und Sicherheit verwalten.">
      <ActionPanel title="Kundendaten" description="Diese Daten werden für Kampagnen, Rechnungen und Rückfragen verwendet.">
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
            Logo optional
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
          <button type="submit">Einstellungen speichern</button>
        </form>
      </ActionPanel>
    </CustomerPortalShell>
  );
}
