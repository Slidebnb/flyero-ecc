"use client";

import { FormEvent, useState } from "react";

type LeadFormProps = {
  defaultType?: "CUSTOMER" | "DISTRIBUTOR" | "PARTNER" | "OTHER";
  source?: string;
  inquiry?: boolean;
};

export function LeadForm({ defaultType = "CUSTOMER", source = "website", inquiry = false }: LeadFormProps) {
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [inquiryNumber, setInquiryNumber] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const form = event.currentTarget;
    const formData = new FormData(form);

    const response = await fetch("/api/leads", {
      method: "POST",
      body: formData,
    });

    const result = await response.json().catch(() => null) as { data?: { inquiryNumber?: string } } | null;
    if (response.ok) {
      form.reset();
      setInquiryNumber(result?.data?.inquiryNumber ?? null);
      setIdempotencyKey(crypto.randomUUID());
      setState("success");
    } else {
      setState("error");
    }
  }

  return (
    <form className="mkLeadForm" onSubmit={onSubmit} aria-describedby={state === "error" ? "lead-form-error" : undefined}>
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input
        aria-hidden="true"
        autoComplete="off"
        name="website"
        style={{ display: "none" }}
        tabIndex={-1}
      />
      <label>
        Name
        <input name="name" minLength={2} required />
      </label>
      <label>
        Firma
        <input name="companyName" />
      </label>
      <label>
        E-Mail
        <input name="email" type="email" required />
      </label>
      <label>
        Telefonnummer
        <input name="phone" />
      </label>
      <label>
        Stadt
        <input name="city" />
      </label>
      {inquiry ? (
        <>
          <label>
            PLZ
            <input name="postalCode" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} />
          </label>
          <label>
            Genaue Adresse (optional)
            <input name="streetAddress" />
          </label>
          <label>
            Flyeranzahl
            <input name="flyerQuantity" type="number" min={1} max={1000000} />
          </label>
          <label>
            Gewünschter Start
            <input name="startDate" type="date" />
          </label>
          <label>
            Gewünschtes Ende
            <input name="endDate" type="date" />
          </label>
          <label>
            Flyer bereits gedruckt?
            <select name="flyersAlreadyPrinted" defaultValue="">
              <option value="">Bitte wählen</option>
              <option value="true">Ja</option>
              <option value="false">Nein</option>
            </select>
          </label>
          <label>
            Flyerformat (optional)
            <input name="flyerFormat" placeholder="z. B. DIN lang" />
          </label>
          <label>
            Zielgruppe (optional)
            <input name="targetGroup" placeholder="z. B. Haushalte" />
          </label>
          <label>
            Verteilart (optional)
            <input name="distributionMode" placeholder="z. B. Haushalt" />
          </label>
          <label className="mkFull">
            Kampagnenziel (optional)
            <input name="campaignGoal" placeholder="Was soll die Verteilung erreichen?" />
          </label>
          <label className="mkCheckbox">
            <input name="flexibleSchedule" type="checkbox" />
            Zeitraum ist flexibel
          </label>
        </>
      ) : null}
      <label>
        Interesse
        <select name="type" defaultValue={defaultType}>
          <option value="CUSTOMER">Flyerverteilung</option>
          <option value="DISTRIBUTOR">Verteiler werden</option>
          <option value="PARTNER">Kooperation</option>
          <option value="OTHER">Sonstiges</option>
        </select>
      </label>
      <label className="mkFull">
        Nachricht
        <textarea name="message" minLength={5} required />
      </label>
      <button type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Wird gesendet..." : "Anfrage senden"}
      </button>
      <p className="mkFormPrivacy">
        Ihre Angaben verwenden wir ausschließlich zur Bearbeitung Ihrer Anfrage. Weitere Informationen finden Sie in der <a href="/datenschutz">Datenschutzerklärung</a>.
      </p>
      {state === "success" ? <p className="mkFormSuccess" role="status" aria-live="polite">Danke, Ihre Anfrage ist eingegangen.{inquiryNumber ? ` Ihre Anfragenummer: ${inquiryNumber}.` : ""}</p> : null}
      {state === "error" ? <p id="lead-form-error" className="mkFormError" role="alert">Bitte prüfen Sie die Angaben und versuchen Sie es erneut.</p> : null}
    </form>
  );
}
