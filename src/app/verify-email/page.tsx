import Link from "next/link";

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <main className="shell">
      <section className="panel compact">
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
