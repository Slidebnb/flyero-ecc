import Link from "next/link";
import type { Metadata } from "next";
import { VerifyEmailForm } from "@/app/verify-email/VerifyEmailForm";
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
        <Link href="/" className="authBack">
          Zur Startseite
        </Link>
        <h1>E-Mail bestätigen</h1>
        <p className="muted">
          Bestätige deine E-Mail-Adresse über den Link aus deiner E-Mail oder fordere einen neuen Link an.
        </p>
        <VerifyEmailForm initialToken={params.token || ""} />
      </section>
    </main>
  );
}
