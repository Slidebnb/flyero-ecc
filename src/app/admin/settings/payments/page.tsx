import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getPaymentConfigStatus } from "@/lib/settings";

export default async function PaymentSettingsPage() {
  await requireRole([UserRole.ADMIN]);
  const status = await getPaymentConfigStatus();
  return (
    <main className="appShell">
      <header className="topbar"><div><p className="eyebrow">Einstellungen</p><h1>Zahlungen</h1></div><nav className="nav"><Link href="/admin/settings">Zurück</Link></nav></header>
      <section className="gridCards">
        <article className="card"><strong>{status.stripeConfigured ? "Ja" : "Nein"}</strong><span>Stripe konfiguriert</span></article>
        <article className="card"><strong>{status.publishableKeyPresent ? "Ja" : "Nein"}</strong><span>Publishable Key vorhanden</span></article>
        <article className="card"><strong>{status.secretKeyPresent ? "Ja" : "Nein"}</strong><span>Secret Key vorhanden</span></article>
        <article className="card"><strong>{status.webhookSecretPresent ? "Ja" : "Nein"}</strong><span>Webhook Secret vorhanden</span></article>
        <article className="card"><strong>{status.testMode ? "Ja" : "Nein"}</strong><span>Testmodus</span></article>
      </section>
    </main>
  );
}

