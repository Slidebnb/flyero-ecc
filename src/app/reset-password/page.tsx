import Link from "next/link";
import type { Metadata } from "next";
import { FlyeroLogo, PremiumFlyerField } from "@/app/components/marketing";
import { ResetPasswordForm } from "@/app/reset-password/ResetPasswordForm";
import { noIndexMetadata } from "@/app/seo";

export const metadata: Metadata = { title: "Neues Passwort", description: "FLYERO Passwort sicher ändern.", ...noIndexMetadata };

type PageProps = { searchParams: Promise<{ token?: string }> };

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <main className="authShell flyeroAuthShell">
      <PremiumFlyerField />
      <section className="authPanel compact flyeroAuthPanel">
        <div className="authBrandRow"><Link href="/" className="authLogoLink" aria-label="Zur FLYERO Startseite"><FlyeroLogo dark /></Link><Link href="/login" className="authBack">Zum Login</Link></div>
        <p className="authEyebrow">Zugang schützen</p>
        <h1>Passwort aktualisieren.</h1>
        <p className="muted">Der Link ist einmalig und 30 Minuten gültig.</p>
        <ResetPasswordForm initialToken={params.token || ""} />
      </section>
    </main>
  );
}
