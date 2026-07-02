import Link from "next/link";

type CustomerRegisterPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

function safeNext(next?: string) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "";
}

export default async function CustomerRegisterPage({ searchParams }: CustomerRegisterPageProps) {
  const params = await searchParams;
  const next = safeNext(params?.next);
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <main className="shell">
      <section className="panel">
        <h1>Kundenregistrierung</h1>
        <form action="/api/auth/register-customer" method="post" className="form grid">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <label>
            Firma
            <input name="companyName" required />
          </label>
          <label>
            Ansprechpartner
            <input name="contactName" required />
          </label>
          <label>
            E-Mail
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Telefon
            <input name="phone" type="tel" required />
          </label>
          <label>
            Rechnungsstraße
            <input name="billingStreet" required />
          </label>
          <label>
            Hausnummer
            <input name="billingHouseNumber" />
          </label>
          <label>
            PLZ
            <input name="billingPostalCode" required />
          </label>
          <label>
            Stadt
            <input name="billingCity" required />
          </label>
          <label>
            Lieferstraße optional
            <input name="deliveryStreet" />
          </label>
          <label>
            Liefer-Hausnummer optional
            <input name="deliveryHouseNumber" />
          </label>
          <label>
            Liefer-PLZ optional
            <input name="deliveryPostalCode" />
          </label>
          <label>
            Lieferstadt optional
            <input name="deliveryCity" />
          </label>
          <label>
            USt-ID optional
            <input name="vatId" />
          </label>
          <label>
            Logo-URL optional
            <input name="logoUrl" type="url" />
          </label>
          <label>
            Passwort
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </label>
          <button type="submit">Kundenkonto erstellen</button>
        </form>
        <p className="muted">
          Bereits registriert? <Link href={loginHref}>Zum Login</Link>
        </p>
      </section>
    </main>
  );
}
