import Link from "next/link";

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
    <main className="shell">
      <section className="panel compact">
        <h1>Login</h1>
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
