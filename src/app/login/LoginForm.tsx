"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";

type NoticeTone = "success" | "warning" | "danger";

type Notice = {
  tone: NoticeTone;
  title: string;
  text: string;
};

type LoginFormProps = {
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

export function LoginForm({ next }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isResending, startResendTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setShowResend(false);

    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ email, password, next }),
      });
      const payload = await readApiResponse(response);

      if (response.ok && payload.ok === true) {
        const data = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : {};
        void fetch("/api/public/planner/experience", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventType: "LOGIN_COMPLETED" }),
        });
        window.location.href = readString(data.redirectTo) || "/customer/dashboard";
        return;
      }

      if (payload.code === "EMAIL_UNVERIFIED") {
        setShowResend(true);
        setNotice({
          tone: "warning",
          title: "E-Mail-Adresse noch nicht bestätigt",
          text: "Bitte bestätige zuerst deine E-Mail-Adresse. Du kannst dir den Link direkt erneut senden lassen.",
        });
        return;
      }

      setNotice({
        tone: "danger",
        title: "Login nicht möglich",
        text: readString(payload.error) || "Die Zugangsdaten passen nicht. Bitte prüfe E-Mail und Passwort.",
      });
    });
  }

  function handleResend() {
    const targetEmail = email.trim();

    if (!targetEmail) {
      setNotice({
        tone: "warning",
        title: "E-Mail fehlt",
        text: "Bitte gib zuerst deine E-Mail-Adresse ein, damit wir den Bestätigungslink senden können.",
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
        body: JSON.stringify({ email: targetEmail }),
      });
      const payload = await readApiResponse(response);
      const data = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : {};

      if (response.ok && payload.ok === true) {
        setNotice({
          tone: data.alreadyVerified ? "success" : "success",
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
      {notice ? (
        <div className={`authNotice ${notice.tone}`} role="status">
          <strong>{notice.title}</strong>
          <span>{notice.text}</span>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="form">
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
          Passwort
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={isPending}>
          {isPending ? "Einloggen ..." : "Einloggen"}
        </button>
      </form>
      {showResend ? (
        <div className="authHelpPanel">
          <strong>Kein Link angekommen?</strong>
          <p>Wir senden dir sofort einen neuen Bestätigungslink an die oben eingetragene E-Mail-Adresse.</p>
          <button type="button" onClick={handleResend} disabled={isResending}>
            {isResending ? "Wird gesendet ..." : "Bestätigungslink erneut senden"}
          </button>
        </div>
      ) : null}
      <p className="muted">
        E-Mail noch nicht bestätigt? <Link href="/verify-email">Link erneut anfordern</Link>
      </p>
      <p className="muted">
        Passwort vergessen? <Link href="/password-reset">Passwort zurücksetzen</Link>
      </p>
    </>
  );
}
