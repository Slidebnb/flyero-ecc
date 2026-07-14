"use client";

import { FormEvent, useState, useTransition } from "react";

type ProfileFields = {
  companyName: string;
  contactName: string;
  phone: string;
  billingStreet: string;
  billingHouseNumber: string;
  billingPostalCode: string;
  billingCity: string;
  vatId: string;
};

type Props = { orderId: string; defaults: ProfileFields };

function readString(value: unknown) { return typeof value === "string" ? value : ""; }

export function ProfileCompletionForm({ orderId, defaults }: Props) {
  const [fields, setFields] = useState(defaults);
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();

  function update(name: keyof ProfileFields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    startTransition(async () => {
      const response = await fetch("/api/customer/profile/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, ...fields }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.data?.redirectTo) {
        window.location.href = readString(payload.data.redirectTo);
        return;
      }
      const missing = Array.isArray(payload?.data?.missingFields) ? payload.data.missingFields.join(", ") : "";
      setNotice(readString(payload?.error) || (missing ? `Bitte ergänze: ${missing}.` : "Die Zahlung konnte noch nicht vorbereitet werden."));
    });
  }

  return (
    <form className="form grid" onSubmit={submit}>
      <label>Firma<input value={fields.companyName} onChange={(event) => update("companyName", event.target.value)} required /></label>
      <label>Ansprechpartner<input value={fields.contactName} onChange={(event) => update("contactName", event.target.value)} required /></label>
      <label>Telefon<input type="tel" value={fields.phone} onChange={(event) => update("phone", event.target.value)} required /></label>
      <label>Rechnungsstraße<input value={fields.billingStreet} onChange={(event) => update("billingStreet", event.target.value)} required /></label>
      <label>Hausnummer optional<input value={fields.billingHouseNumber} onChange={(event) => update("billingHouseNumber", event.target.value)} /></label>
      <label>Rechnungs-PLZ<input value={fields.billingPostalCode} onChange={(event) => update("billingPostalCode", event.target.value)} required /></label>
      <label>Rechnungsstadt<input value={fields.billingCity} onChange={(event) => update("billingCity", event.target.value)} required /></label>
      <label>USt-ID optional<input value={fields.vatId} onChange={(event) => update("vatId", event.target.value)} /></label>
      {notice ? <p className="authNotice danger" role="alert">{notice}</p> : null}
      <button type="submit" disabled={isPending}>{isPending ? "Zahlung wird vorbereitet ..." : "Speichern und sicher bezahlen"}</button>
    </form>
  );
}
