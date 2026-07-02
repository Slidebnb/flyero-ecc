"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/monitoring/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        pathname: window.location.pathname,
      }),
    }).catch(() => undefined);
  }, [error]);

  return (
    <main className="shell">
      <section className="panel compact stack">
        <p className="eyebrow">Systemhinweis</p>
        <h1>Da ist etwas schiefgelaufen.</h1>
        <p className="muted">
          Der Fehler wurde intern protokolliert. Bitte versuche es erneut oder gehe zurück zum Dashboard.
        </p>
        <div className="actions">
          <button type="button" onClick={reset}>Erneut versuchen</button>
          <Link href="/">Zur Startseite</Link>
        </div>
      </section>
    </main>
  );
}
