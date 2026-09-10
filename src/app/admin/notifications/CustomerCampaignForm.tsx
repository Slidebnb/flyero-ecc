"use client";

import { useState } from "react";

export function CustomerCampaignForm() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.confirm !== "yes") {
      setNotice({ ok: false, text: "Bitte bestätige zuerst, dass die Nachricht an alle berechtigten Kunden gesendet werden soll." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/notifications/customer-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...data, idempotencyKey: crypto.randomUUID() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Die Kundenaktion konnte nicht vorgemerkt werden.");
      const result = payload?.data;
      setNotice({ ok: true, text: `Kundenaktion vorgemerkt: ${result.queuedCount} E-Mails in der Queue, ${result.skippedCount} ohne Versand (z. B. deaktivierte E-Mail-Einstellung).` });
      form.reset();
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "Die Kundenaktion konnte nicht vorgemerkt werden." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <p className="muted">Der Code muss vorher als aktiver Promotion-Code in Stripe angelegt sein. Im Checkout kann der Kunde ihn dann selbst eingeben.</p>
      <label>Betreff<input name="subject" required maxLength={140} placeholder="Ihr Vorteil bei der nächsten Flyer-Kampagne" /></label>
      <label>Überschrift<input name="title" required maxLength={140} placeholder="10 % Vorteil für Ihre nächste Bestellung" /></label>
      <label>Nachricht<textarea name="body" required maxLength={4000} rows={6} placeholder="Beschreibe den Vorteil, die Bedingungen und den Zeitraum verständlich." /></label>
      <label>Stripe-Promotion-Code<input name="couponCode" required maxLength={64} pattern="[A-Za-z0-9_-]{3,64}" placeholder="FLYERO10" /></label>
      <label className="checkboxRow"><input name="confirm" value="yes" type="checkbox" required /> Ich bestätige, dass diese Nachricht an alle aktiven, bestätigten Kunden meines Bereichs gesendet werden soll.</label>
      {notice ? <p className="notice" role="status" style={{ borderColor: notice.ok ? "#b7ff21" : "#ef9a9a" }}>{notice.text}</p> : null}
      <button type="submit" disabled={busy}>{busy ? "Wird vorgemerkt …" : "Kundenaktion an alle senden"}</button>
    </form>
  );
}
