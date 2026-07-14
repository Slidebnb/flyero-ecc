import Link from "next/link";
import type { Metadata } from "next";
import { CustomerRegisterForm } from "@/app/register/customer/CustomerRegisterForm";
import { noIndexMetadata } from "@/app/seo";

export const metadata: Metadata = {
  title: "Kundenkonto erstellen",
  description: "FLYERO Kundenkonto erstellen.",
  ...noIndexMetadata,
};

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
    <main className="authShell">
      <section className="authPanel">
        <Link href="/" className="authBack">
          Zur Startseite
        </Link>
        <h1>Kundenregistrierung</h1>
        <p className="muted">
          Erstellen Sie zuerst Ihr Konto. Rechnungsdaten können Sie vor der kostenpflichtigen Buchung ergänzen.
        </p>
        <CustomerRegisterForm next={next} />
        <p className="muted">
          Bereits registriert? <Link href={loginHref}>Zum Login</Link>
        </p>
      </section>
    </main>
  );
}
