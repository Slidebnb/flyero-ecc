import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireTenantSession } from "@/lib/tenant";
import { asObject, formatDateTime } from "@/lib/format";
import { listUserSessions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CustomerProfilePage() {
  const session = await requireTenantSession();
  const profile = await prisma.customerProfile.findUnique({
    where: { userId: session.id, tenantId: session.tenantId },
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
  const sessions = await listUserSessions(session.id, session.sessionId);

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

      {/* Browser autofill can add a caret style before React hydrates this server-rendered form. */}
      <form action="/api/customer/profile" method="post" className="customerProfileForm">
        <div className="customerTwoColumn">
          <DataSection title="Kontakt" description="Für Rückfragen zur Kampagne.">
            <div className="form grid">
              <label>
                Firma
                <input name="companyName" defaultValue={profile.companyName} required suppressHydrationWarning />
              </label>
              <label>
                Ansprechpartner
                <input name="contactName" defaultValue={profile.contactName} required suppressHydrationWarning />
              </label>
              <label>
                E-Mail
                <input value={profile.user.email} disabled suppressHydrationWarning />
              </label>
              <label>
                Telefon
                <input name="phone" defaultValue={profile.phone} required suppressHydrationWarning />
              </label>
            </div>
          </DataSection>

          <DataSection title="Rechnung" description="Diese Adresse erscheint auf Rechnungen.">
            <div className="form grid">
              <label>
                Straße
                <input name="billingStreet" defaultValue={String(billing.street || "")} required suppressHydrationWarning />
              </label>
              <label>
                Hausnummer
                <input name="billingHouseNumber" defaultValue={String(billing.houseNumber || "")} suppressHydrationWarning />
              </label>
              <label>
                PLZ
                <input name="billingPostalCode" defaultValue={String(billing.postalCode || "")} required suppressHydrationWarning />
              </label>
              <label>
                Stadt
                <input name="billingCity" defaultValue={String(billing.city || "")} required suppressHydrationWarning />
              </label>
              <label>
                USt-ID optional
                <input name="vatId" defaultValue={profile.vatId || ""} suppressHydrationWarning />
              </label>
              <label>
                Logo optional
                <input name="logoUrl" type="url" defaultValue={profile.logoUrl || ""} suppressHydrationWarning />
              </label>
            </div>
          </DataSection>
        </div>

        <details className="customerSoftDetails">
          <summary>Lieferadresse nur bei Bedarf öffnen</summary>
          <DataSection title="Lieferadresse optional" description="Nur ausfüllen, wenn Flyer oder Druckdaten an eine andere Adresse gehen sollen.">
            <div className="form grid">
              <label>
                Straße
                <input name="deliveryStreet" defaultValue={String(delivery.street || "")} suppressHydrationWarning />
              </label>
              <label>
                Hausnummer
                <input name="deliveryHouseNumber" defaultValue={String(delivery.houseNumber || "")} suppressHydrationWarning />
              </label>
              <label>
                PLZ
                <input name="deliveryPostalCode" defaultValue={String(delivery.postalCode || "")} suppressHydrationWarning />
              </label>
              <label>
                Stadt
                <input name="deliveryCity" defaultValue={String(delivery.city || "")} suppressHydrationWarning />
              </label>
            </div>
          </DataSection>
        </details>

        <details className="customerSoftDetails">
          <summary>Passwort ändern</summary>
          <DataSection title="Passwort optional" description="Nur ausfüllen, wenn Sie das Passwort ändern möchten.">
            <div className="form grid">
              <label>
                Aktuelles Passwort
                <input name="currentPassword" type="password" autoComplete="current-password" suppressHydrationWarning />
              </label>
              <label>
                Neues Passwort
                <input name="newPassword" type="password" autoComplete="new-password" minLength={10} suppressHydrationWarning />
              </label>
            </div>
          </DataSection>
        </details>

        <div className="customerStickySave" id="profile-save">
          <span>Änderungen werden erst nach dem Speichern übernommen.</span>
          <button type="submit">Profil speichern</button>
        </div>
      </form>

      <DataSection title="Sicherheit" description="Behalte den Überblick über aktive Anmeldungen in deinem Konto.">
        <div className="stack">
          {sessions.map((authSession) => (
            <div className="mobileListItem" key={authSession.id}>
              <strong>{authSession.isCurrent ? "Dieses Gerät" : "Aktive Anmeldung"}</strong>
              <small>Anmeldung: {formatDateTime(authSession.createdAt)}</small>
              <small>Zuletzt aktiv: {formatDateTime(authSession.lastSeenAt)}</small>
              {authSession.isCurrent ? <StatusBadge tone="success">Aktuell</StatusBadge> : null}
            </div>
          ))}
          <p className="muted">Wenn du ein anderes Gerät nicht mehr verwendest, kannst du alle anderen Anmeldungen sofort beenden.</p>
          <form action="/api/auth/sessions" method="post">
            <button type="submit">Alle anderen Sitzungen abmelden</button>
          </form>
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
