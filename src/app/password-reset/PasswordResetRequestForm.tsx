"use client";

import { FormEvent, useState, useTransition } from "react";

export function PasswordResetRequestForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/auth/request-password-reset", { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const payload = await response.json().catch(() => ({})) as { data?: { message?: string }; error?: string };
      if (response.ok) setMessage(payload.data?.message || "Wenn zu dieser E-Mail ein aktives Konto existiert, senden wir dir einen Link.");
      else setError(payload.error || "Die Anfrage konnte nicht verarbeitet werden.");
    });
  }

  return (
    <>
      {message ? <div className="authNotice success" role="status"><strong>E-Mail geprüft</strong><span>{message}</span></div> : null}
      {error ? <div className="authNotice danger" role="alert"><strong>Anfrage nicht möglich</strong><span>{error}</span></div> : null}
      <form onSubmit={handleSubmit} className="form">
        <label>E-Mail<input name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <button type="submit" disabled={isPending}>{isPending ? "Wird geprüft ..." : "Link anfordern"}</button>
      </form>
    </>
  );
}
