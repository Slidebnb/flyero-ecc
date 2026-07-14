"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState, useTransition } from "react";

type NoticeTone = "success" | "warning" | "danger";

type Notice = {
  tone: NoticeTone;
  title: string;
  text: string;
};

type VerifyEmailFormProps = {
  initialToken: string;
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

export function VerifyEmailForm({ initialToken }: VerifyEmailFormProps) {
  const [token, setToken] = useState(initialToken);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [continueHref, setContinueHref] = useState("/login");
  const [isPending, startTransition] = useTransition();
  const [isResending, startResendTransition] = useTransition();
  const autoSubmitted = useRef(false);

  function verifyToken(nextToken: string) {
    const trimmedToken = nextToken.trim();

    if (!trimmedToken) {
      setNotice({
        tone: "warning",
        title: "Token fehlt",
        text: "Bitte füge den Bestätigungslink oder Token aus deiner E-Mail ein.",
      });
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ token: trimmedToken }),
      });
      const payload = await readApiResponse(response);

      if (response.ok && payload.ok === true) {
        const data = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : {};
        const redirectTo = readString(data.redirectTo) || "/login";
        setContinueHref(redirectTo);
        setNotice({
          tone: "success",
          title: "E-Mail bestätigt",
          text: "Dein Konto ist jetzt aktiviert. Wir bringen dich direkt zum Login für deinen nächsten Schritt. Ein lokal gespeicherter Entwurf ist nur auf dem Gerät verfügbar, auf dem du geplant hast.",
        });
        window.setTimeout(() => {
          window.location.href = redirectTo;
        }, 900);
        return;
      }

      setNotice({
        tone: "danger",
        title: "Bestätigung nicht möglich",
        text:
          readString(payload.error) ||
          "Der Link ist ungültig oder abgelaufen. Du kannst dir unten einen neuen Link senden lassen.",
      });
    });
  }

  useEffect(() => {
    if (!initialToken || autoSubmitted.current) return;
    autoSubmitted.current = true;
    verifyToken(initialToken);
  }, [initialToken]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    verifyToken(token);
  }

  function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetEmail = email.trim();

    if (!targetEmail) {
      setNotice({
        tone: "warning",
        title: "E-Mail fehlt",
        text: "Bitte gib deine E-Mail-Adresse ein, damit wir den Bestätigungslink senden können.",
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
        body: JSON.stringify({ email: targetEmail, token }),
      });
      const payload = await readApiResponse(response);
      const data = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : {};

      if (response.ok && payload.ok === true) {
        setNotice({
          tone: "success",
          title: data.alreadyVerified ? "E-Mail bereits bestätigt" : "Bestätigungslink gesendet",
          text:
            readString(data.message) ||
            "Wenn zu dieser E-Mail ein offenes Konto existiert, senden wir einen neuen Bestätigungslink.",
        });
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
          Bestätigungstoken
          <input name="token" value={token} onChange={(event) => setToken(event.target.value)} required />
        </label>
        <button type="submit" disabled={isPending}>
          {isPending ? "Wird bestätigt ..." : "E-Mail bestätigen"}
        </button>
      </form>
      <form onSubmit={handleResend} className="authHelpPanel">
        <strong>Link abgelaufen oder nicht angekommen?</strong>
        <p>Fordere hier einen neuen Bestätigungslink an.</p>
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
        <button type="submit" disabled={isResending}>
          {isResending ? "Wird gesendet ..." : "Bestätigungslink senden"}
        </button>
      </form>
      <p className="muted">
        Bereits bestätigt? <Link href={continueHref}>Zum Login</Link>
      </p>
    </>
  );
}
