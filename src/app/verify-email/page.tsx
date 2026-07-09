import Link from "next/link";
import type { Metadata } from "next";
import { noIndexMetadata } from "@/app/seo";

export const metadata: Metadata = {
  title: "E-Mail bestätigen",
  description: "FLYERO E-Mail-Verifizierung.",
  ...noIndexMetadata,
};

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <main className="authShell">
      <section className="authPanel compact">
        <Link href="/" className="authBack">Zur Startseite</Link>
        <h1>E-Mail bestätigen</h1>
        <p className="muted">
          Gib den Verifizierungstoken ein. Nach erfolgreicher Bestätigung kannst
          du dich einloggen.
        </p>
        <form action="/api/auth/verify-email" method="post" className="form">
          <label>
            Verifizierungstoken
            <input name="token" defaultValue={params.token || ""} required />
          </label>
          <button type="submit">E-Mail bestätigen</button>
        </form>
        <p className="muted">
          Bereits bestätigt? <Link href="/login">Zum Login</Link>
        </p>
      </section>
    </main>
  );
}
