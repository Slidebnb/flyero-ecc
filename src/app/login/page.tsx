import Link from "next/link";
import type { Metadata } from "next";
import { FlyeroLogo, PremiumFlyerField } from "@/app/components/marketing";
import { LoginForm } from "@/app/login/LoginForm";
import { noIndexMetadata } from "@/app/seo";
import { safeInternalRedirectPath } from "@/lib/redirects";

export const metadata: Metadata = {
  title: "Login",
  description: "FLYERO Kundenportal Login.",
  ...noIndexMetadata,
};

type LoginPageProps = {
  searchParams?: Promise<{ next?: string; registered?: string; verificationEmailSent?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeInternalRedirectPath(params?.next, "");
  const customerRegisterHref = next
    ? `/register/customer?next=${encodeURIComponent(next)}`
    : "/register/customer";
  const justRegistered = params?.registered === "customer" || params?.registered === "distributor";
  const verificationEmailSent = params?.verificationEmailSent === "true";

  return (
    <main className="authShell flyeroAuthShell">
      <PremiumFlyerField />
      <section className="authPanel compact flyeroAuthPanel">
        <div className="authBrandRow">
          <Link href="/" className="authLogoLink" aria-label="Zur FLYERO Startseite">
            <FlyeroLogo dark />
          </Link>
          <Link href="/" className="authBack">
            Startseite
          </Link>
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
        {justRegistered ? (
          <div className={`authNotice ${verificationEmailSent ? "success" : "warning"}`} role="status">
            <strong>{verificationEmailSent ? "Konto erstellt" : "Konto erstellt, E-Mail noch nicht zugestellt"}</strong>
            <span>
              {verificationEmailSent
                ? "Wir haben dir eine Bestätigungs-Mail gesendet. Bitte prüfe auch den Spam-Ordner und bestätige deine E-Mail-Adresse vor dem ersten Login."
                : "Die Registrierung ist gespeichert, aber die Bestätigungs-Mail konnte gerade nicht zugestellt werden. Gib deine E-Mail unten ein und fordere den Link erneut an."}
            </span>
          </div>
        ) : null}
        <LoginForm next={next} />
        <p className="muted">
          Noch kein Zugang? <Link href={customerRegisterHref}>Kunde</Link> oder{" "}
          <Link href="/register/distributor">Verteiler</Link> registrieren.
        </p>
      </section>
    </main>
  );
}
