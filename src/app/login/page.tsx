import Link from "next/link";
import type { Metadata } from "next";
import { FlyeroLogo, PremiumFlyerField } from "@/app/components/marketing";
import { noIndexMetadata } from "@/app/seo";

export const metadata: Metadata = {
  title: "Login",
  description: "FLYERO Kundenportal Login.",
  ...noIndexMetadata,
};

type LoginPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

function safeNext(next?: string) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeNext(params?.next);
  const customerRegisterHref = next
    ? `/register/customer?next=${encodeURIComponent(next)}`
    : "/register/customer";

  return (
    <main className="authShell flyeroAuthShell">
      <PremiumFlyerField />
      <section className="authPanel compact flyeroAuthPanel">
        <div className="authBrandRow">
          <Link href="/" className="authLogoLink" aria-label="Zur FLYERO Startseite">
            <FlyeroLogo dark />
          </Link>
          <Link href="/" className="authBack">Startseite</Link>
        </div>
        <p className="authEyebrow">Kundenportal</p>
        <h1>Einloggen und Nachweise prüfen.</h1>
        <p className="muted">
          Melden Sie sich an, um Aufträge, GPS-Berichte, Foto-Dokumentation und Rechnungen zentral zu verwalten.
        </p>
        <div className="authProofStrip" aria-label="FLYERO Nachweisfunktionen">
          <span>GPS-Nachweis</span>
          <span>Foto-Dokumentation</span>
          <span>PDF-Bericht</span>
        </div>
        <form action="/api/auth/login" method="post" className="form">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <label>
            E-Mail
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Passwort
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit">Einloggen</button>
        </form>
        <p className="muted">
          Noch kein Zugang? <Link href={customerRegisterHref}>Kunde</Link> oder{" "}
          <Link href="/register/distributor">Verteiler</Link> registrieren.
        </p>
        <p className="muted">
          E-Mail noch nicht bestätigt? <Link href="/verify-email">Token eingeben</Link>
        </p>
      </section>
    </main>
  );
}
