"use client";

import { FormEvent, useState } from "react";

type LeadFormProps = {
  defaultType?: "CUSTOMER" | "DISTRIBUTOR" | "PARTNER" | "OTHER";
  source?: string;
};

export function LeadForm({ defaultType = "CUSTOMER", source = "website" }: LeadFormProps) {
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const form = event.currentTarget;
    const formData = new FormData(form);

    const response = await fetch("/api/leads", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      form.reset();
      setState("success");
    } else {
      setState("error");
    }
  }

  return (
    <form className="form grid marketingForm" onSubmit={onSubmit}>
      <input type="hidden" name="source" value={source} />
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
      <label>
        Interesse
        <select name="type" defaultValue={defaultType}>
          <option value="CUSTOMER">Flyerverteilung</option>
          <option value="DISTRIBUTOR">Verteiler werden</option>
          <option value="PARTNER">Kooperation</option>
          <option value="OTHER">Sonstiges</option>
        </select>
      </label>
      <label className="full">
        Nachricht
        <textarea name="message" minLength={5} required />
      </label>
      <button type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Wird gesendet..." : "Anfrage senden"}
      </button>
      {state === "success" ? <p className="formSuccess">Danke, deine Anfrage ist eingegangen.</p> : null}
      {state === "error" ? <p className="formError">Bitte prüfe die Angaben und versuche es erneut.</p> : null}
    </form>
  );
}
