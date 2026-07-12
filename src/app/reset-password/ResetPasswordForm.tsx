"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";

export function ResetPasswordForm({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (password !== confirmation) { setError("Die Passwörter stimmen nicht überein."); return; }
    startTransition(async () => {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ token, password }) });
      const payload = await response.json().catch(() => ({})) as { data?: { message?: string }; error?: string };
      if (response.ok) { setMessage(payload.data?.message || "Dein Passwort wurde geändert."); setPassword(""); setConfirmation(""); }
      else setError(payload.error || "Der Link ist ungültig oder abgelaufen.");
    });
  }

  return (
    <>
      {message ? <div className="authNotice success" role="status"><strong>Passwort geändert</strong><span>{message} <Link href="/login">Jetzt einloggen</Link></span></div> : null}
      {error ? <div className="authNotice danger" role="alert"><strong>Änderung nicht möglich</strong><span>{error}</span></div> : null}
      <form onSubmit={handleSubmit} className="form">
        <label>Reset-Token<input name="token" value={token} onChange={(event) => setToken(event.target.value)} required /></label>
        <label>Neues Passwort<input name="password" type="password" autoComplete="new-password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <label>Passwort wiederholen<input name="confirmation" type="password" autoComplete="new-password" minLength={10} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
        <button type="submit" disabled={isPending}>{isPending ? "Wird gespeichert ..." : "Passwort speichern"}</button>
      </form>
      <p className="muted"><Link href="/password-reset">Neuen Link anfordern</Link></p>
    </>
  );
}
