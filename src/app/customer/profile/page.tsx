import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { DataSection, EmptyState } from "@/app/PortalComponents";
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
      <CustomerPortalShell active="/customer/profile" title="Profil" description="Kontodaten, Rechnung und Sicherheit.">
        <EmptyState title="Kundenprofil wurde nicht gefunden." description="Bitte melden Sie sich erneut an oder kontaktieren Sie den Support." />
      </CustomerPortalShell>
    );
  }

  const billing = asObject(profile.billingAddress);
  const delivery = asObject(profile.deliveryAddress);

  return (
    <CustomerPortalShell active="/customer/profile" title="Profil" description="Daten für Kampagnen, Rechnungen und Rückfragen.">
      <section className="customerFocusPanel">
        <div>
          <span className="customerTinyLabel">Konto</span>
          <h2>Stammdaten aktuell halten.</h2>
          <p>FLYERO nutzt diese Angaben für Rückfragen, Rechnungen und die Zuordnung Ihrer Kampagnen.</p>
        </div>
        <a className="primaryButton" href="#profile-save">Speichern</a>
      </section>

      <form action="/api/customer/profile" method="post" className="customerProfileForm">
        <div className="customerTwoColumn">
          <DataSection title="Kontakt" description="Für Rückfragen zur Kampagne.">
            <div className="form grid">
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
            </div>
          </DataSection>

          <DataSection title="Rechnung" description="Diese Adresse erscheint auf Rechnungen.">
            <div className="form grid">
              <label>
                Straße
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
                USt-ID optional
                <input name="vatId" defaultValue={profile.vatId || ""} />
              </label>
              <label>
                Logo optional
                <input name="logoUrl" type="url" defaultValue={profile.logoUrl || ""} />
              </label>
            </div>
          </DataSection>
        </div>

        <div className="customerTwoColumn">
          <DataSection title="Lieferadresse optional" description="Nur ausfüllen, wenn Flyer oder Druckdaten an eine andere Adresse gehen sollen.">
            <div className="form grid">
              <label>
                Straße
                <input name="deliveryStreet" defaultValue={String(delivery.street || "")} />
              </label>
              <label>
                Hausnummer
                <input name="deliveryHouseNumber" defaultValue={String(delivery.houseNumber || "")} />
              </label>
              <label>
                PLZ
                <input name="deliveryPostalCode" defaultValue={String(delivery.postalCode || "")} />
              </label>
              <label>
                Stadt
                <input name="deliveryCity" defaultValue={String(delivery.city || "")} />
              </label>
            </div>
          </DataSection>

          <DataSection title="Passwort optional" description="Nur ausfüllen, wenn Sie das Passwort ändern möchten.">
            <div className="form grid">
              <label>
                Aktuelles Passwort
                <input name="currentPassword" type="password" autoComplete="current-password" />
              </label>
              <label>
                Neues Passwort
                <input name="newPassword" type="password" autoComplete="new-password" minLength={10} />
              </label>
            </div>
          </DataSection>
        </div>

        <div className="customerStickySave" id="profile-save">
          <span>Änderungen werden erst nach dem Speichern übernommen.</span>
          <button type="submit">Profil speichern</button>
        </div>
      </form>
    </CustomerPortalShell>
  );
}
