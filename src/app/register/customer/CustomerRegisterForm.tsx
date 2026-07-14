"use client";

import { FormEvent, useState, useTransition } from "react";

type NoticeTone = "success" | "warning" | "danger";

type Notice = {
  tone: NoticeTone;
  title: string;
  text: string;
};

type CustomerRegisterFormProps = {
  next: string;
};

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function readApiResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function CustomerRegisterForm({ next }: CustomerRegisterFormProps) {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dialogNotice, setDialogNotice] = useState<Notice | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isResending, startResendTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setDialogNotice(null);
    setShowResend(false);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());
    const submittedEmail = readString(body.email).trim().toLowerCase();
    if (next) body.next = next;
    setEmail(submittedEmail);

    void fetch("/api/public/planner/experience", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventType: "REGISTRATION_STARTED" }),
    });

    startTransition(async () => {
      const response = await fetch("/api/auth/register-customer", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = await readApiResponse(response);
      const data = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : {};

      if (response.ok && payload.ok === true) {
        void fetch("/api/public/planner/experience", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventType: "REGISTRATION_COMPLETED" }),
        });
        const verificationEmailSent = data.verificationEmailSent !== false;
        setShowResend(!verificationEmailSent);
        setDialogNotice({
          tone: verificationEmailSent ? "success" : "warning",
          title: verificationEmailSent ? "Bestätigungslink gesendet" : "Konto erstellt",
          text: verificationEmailSent
            ? "Wir haben dir einen Bestätigungslink per E-Mail gesendet. Öffne dein Postfach und bestätige deine E-Mail-Adresse, bevor du dich einloggst."
            : "Dein Konto wurde erstellt, aber der Bestätigungslink konnte gerade nicht automatisch versendet werden. Du kannst ihn danach erneut anfordern.",
        });
        form.reset();
        setEmail(submittedEmail);
        return;
      }

      const duplicate = response.status === 409;
      setShowResend(duplicate);
      setNotice({
        tone: duplicate ? "warning" : "danger",
        title: duplicate ? "E-Mail bereits registriert" : "Registrierung nicht möglich",
        text:
          readString(payload.error) ||
          "Bitte prüfe die Angaben. Falls du schon ein Konto hast, kannst du dich direkt einloggen.",
      });
    });
  }

  function handleResend() {
    const targetEmail = email.trim();

    if (!targetEmail) {
      setNotice({
        tone: "warning",
        title: "E-Mail fehlt",
        text: "Bitte trage deine E-Mail-Adresse ein, damit wir den Bestätigungslink senden können.",
      });
      return;
    }

    startResendTransition(async () => {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: targetEmail, next }),
      });
      const payload = await readApiResponse(response);
      const data = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : {};

      if (response.ok && payload.ok === true) {
        setNotice(null);
        setDialogNotice({
          tone: "success",
          title: data.alreadyVerified ? "E-Mail bereits bestätigt" : "Bestätigungslink gesendet",
          text:
            readString(data.message) ||
            "Wenn zu dieser E-Mail ein offenes Konto existiert, senden wir einen neuen Bestätigungslink.",
        });
        setShowResend(!data.alreadyVerified);
        return;
      }

      setNotice({
        tone: "danger",
        title: "Versand nicht möglich",
        text: readString(payload.error) || "Der Bestätigungslink konnte gerade nicht gesendet werden.",
      });
    });
  }

  return (
    <>
      {dialogNotice ? (
        <div className="authDialogBackdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDialogNotice(null);
        }}>
          <section
            className={`authDialog ${dialogNotice.tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-dialog-title"
            aria-describedby="auth-dialog-text"
          >
            <div className="authDialogIcon" aria-hidden="true">
              {dialogNotice.tone === "success" ? "✓" : "!"}
            </div>
            <div className="authDialogContent">
              <p className="authDialogEyebrow">Kundenkonto</p>
              <h2 id="auth-dialog-title">{dialogNotice.title}</h2>
              <p id="auth-dialog-text">{dialogNotice.text}</p>
              <button type="button" className="authDialogClose" onClick={() => setDialogNotice(null)} autoFocus>
                Verstanden
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {notice ? (
        <div className={`authNotice ${notice.tone}`} role="status">
          <strong>{notice.title}</strong>
          <span>{notice.text}</span>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="form grid">
        <label>
          Firma
          <input name="companyName" required />
        </label>
        <label>
          Ansprechpartner
          <input name="contactName" required />
        </label>
        <label>
          E-Mail
          <input
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Telefon optional
          <input name="phone" type="tel" />
        </label>
        <label>
          Passwort
          <input name="password" type="password" autoComplete="new-password" minLength={10} required />
        </label>
        <button type="submit" disabled={isPending}>
          {isPending ? "Konto wird erstellt ..." : "Kundenkonto erstellen"}
        </button>
      </form>
      {showResend ? (
        <div className="authHelpPanel">
          <strong>Bestätigung noch offen?</strong>
          <p>Wir senden dir den Bestätigungslink erneut an die eingetragene E-Mail-Adresse.</p>
          <button type="button" onClick={handleResend} disabled={isResending}>
            {isResending ? "Wird gesendet ..." : "Bestätigungslink erneut senden"}
          </button>
        </div>
      ) : null}
    </>
  );
}
