import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="shell">
      <section className="panel compact stack">
        <p className="eyebrow">404</p>
        <h1>Seite nicht gefunden.</h1>
        <p className="muted">
          Diese Seite existiert nicht oder ist nicht mehr verfügbar.
        </p>
        <div className="actions">
          <Link href="/">Zur Startseite</Link>
          <Link href="/login">Zum Login</Link>
        </div>
      </section>
    </main>
  );
}
