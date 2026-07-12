import Link from "next/link";
import type { Metadata } from "next";
import { FlyeroLogo, PremiumFlyerField } from "@/app/components/marketing";
import { PasswordResetRequestForm } from "@/app/password-reset/PasswordResetRequestForm";
import { noIndexMetadata } from "@/app/seo";

export const metadata: Metadata = { title: "Passwort zurücksetzen", description: "FLYERO Zugang wiederherstellen.", ...noIndexMetadata };

export default function PasswordResetPage() {
  return (
    <main className="authShell flyeroAuthShell">
      <PremiumFlyerField />
      <section className="authPanel compact flyeroAuthPanel">
        <div className="authBrandRow"><Link href="/" className="authLogoLink" aria-label="Zur FLYERO Startseite"><FlyeroLogo dark /></Link><Link href="/login" className="authBack">Zum Login</Link></div>
        <p className="authEyebrow">Zugang wiederherstellen</p>
        <h1>Neues Passwort festlegen.</h1>
        <p className="muted">Gib deine E-Mail-Adresse ein. Wenn ein aktives Konto existiert, erhältst du einen sicheren Link.</p>
        <PasswordResetRequestForm />
        <p className="muted"><a href="/login">Zurück zum Login</a></p>
      </section>
    </main>
  );
}
