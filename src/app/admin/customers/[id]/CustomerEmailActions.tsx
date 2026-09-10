"use client";

import { useState } from "react";

export type CustomerEmailHistoryItem = {
  id: string;
  type: string;
  subject: string;
  createdAt: string;
  orderNumber: string | null;
};

export type CustomerPaymentEmailItem = {
  orderId: string;
  orderNumber: string;
};

type Props = {
  customerId: string;
  recipientEmail: string;
  verificationAvailable: boolean;
  paymentEmails: CustomerPaymentEmailItem[];
  history: CustomerEmailHistoryItem[];
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function typeLabel(type: string, subject: string) {
  if (type === "ORDER_ACCEPTED_PAYMENT_REQUIRED" || type.includes("PAYMENT")) return "Zahlungs-E-Mail";
  if (type.includes("INVOICE")) return "Rechnung";
  if (type.includes("REPORT")) return "Abschluss-/Verteilungsbericht";
  if (type.includes("ORDER") || type.includes("BOOKING")) return "Auftragsbestätigung";
  if (type.includes("LOGISTICS") || type.includes("WAREHOUSE")) return "Lager- und Versandinformation";
  if (type.includes("DISTRIBUTION") || type.includes("TOUR")) return "Verteilungsinformation";
  return subject;
}

export function CustomerEmailActions({ customerId, recipientEmail, verificationAvailable, paymentEmails, history }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string; paymentUrl?: string } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  async function copyPaymentLink(url: string) {
    try {
      if (!navigator.clipboard) throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function resend(action: string, fallbackLabel: string, note = "", sendEmail = true) {
    if (busy) return;
    setBusy(action);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/customers/${encodeURIComponent(customerId)}/emails/resend`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `${fallbackLabel} konnte nicht versendet werden.`);
      const label = payload?.data?.label || fallbackLabel;
      const address = payload?.data?.recipientEmail || recipientEmail;
      const paymentUrl = typeof payload?.data?.paymentUrl === "string" ? payload.data.paymentUrl : undefined;
      setCopied(false);
      setNotice({ tone: "success", text: sendEmail ? `E-Mail „${label}“ wurde erfolgreich an ${address} gesendet.` : `Der Zahlungslink für ${payload?.data?.orderNumber || "diesen Auftrag"} ist bereit. Es wurde keine E-Mail versendet.`, paymentUrl });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : `${fallbackLabel} konnte nicht versendet werden.` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {recipientEmail ? <p><strong>Empfänger:</strong> {recipientEmail}</p> : <p className="notice">Für diesen Kunden ist keine E-Mail-Adresse hinterlegt. Der interne Zahlungslink kann trotzdem erzeugt werden.</p>}
      {notice ? (
        <div className="notice" role="status" style={{ borderColor: notice.tone === "success" ? "#b7ff21" : "#ef9a9a" }}>
          <p style={{ margin: 0 }}>{notice.text}</p>
          {notice.paymentUrl ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginTop: "0.65rem" }}>
              <a href={notice.paymentUrl} target="_blank" rel="noreferrer">Zahlungslink für diesen Auftrag öffnen</a>
              <button type="button" onClick={() => { void copyPaymentLink(notice.paymentUrl!); }}>
                {copied ? "Link kopiert" : "Link kopieren"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {verificationAvailable ? (
          <div className="portalActions" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span><strong>E-Mail-Verifizierung</strong><br /><small>Neuen Bestätigungslink senden</small></span>
            <button type="button" onClick={() => resend("verification", "E-Mail-Verifizierung erneut senden")} disabled={Boolean(busy) || !recipientEmail}> {busy === "verification" ? "Wird gesendet …" : "Erneut senden"}</button>
          </div>
        ) : null}
        {paymentEmails.map((item) => {
          const action = `payment:${item.orderId}`;
          return (
            <div key={action} style={{ display: "grid", gap: "0.65rem" }}>
              <div className="portalActions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span><strong>Zahlungs-E-Mail</strong><br /><small>Auftrag {item.orderNumber} · geprüfter Stripe-Link für genau diesen Auftrag</small></span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => resend(`payment-link:${item.orderId}`, `Zahlungslink für ${item.orderNumber}`, "", false)} disabled={Boolean(busy)}>{busy === `payment-link:${item.orderId}` ? "Wird erstellt …" : "Link anzeigen"}</button>
                  <button type="button" onClick={() => resend(action, `Zahlungs-E-Mail für ${item.orderNumber}`, notes[action])} disabled={Boolean(busy) || !recipientEmail}>{busy === action ? "Wird gesendet …" : "E-Mail senden"}</button>
                </div>
              </div>
              <label>
                <span className="sr-only">Zusatzinfo für Auftrag {item.orderNumber}</span>
                <textarea rows={3} value={notes[action] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [action]: event.target.value }))} placeholder="Zusatzinfo an den Kunden (optional)" maxLength={2000} disabled={Boolean(busy)} style={{ width: "100%", resize: "vertical" }} />
              </label>
            </div>
          );
        })}
        {history.map((item) => {
          const action = `notification:${item.id}`;
          return (
            <div className="portalActions" style={{ justifyContent: "space-between", alignItems: "center" }} key={item.id}>
              <span><strong>{typeLabel(item.type, item.subject)}</strong>{item.orderNumber ? <><br /><small>Auftrag {item.orderNumber} · </small></> : <br />}<small>{item.subject} · {dateLabel(item.createdAt)}</small></span>
              <button type="button" onClick={() => resend(action, item.subject)} disabled={Boolean(busy) || !recipientEmail}>{busy === action ? "Wird gesendet …" : "Erneut senden"}</button>
            </div>
          );
        })}
        {!verificationAvailable && paymentEmails.length === 0 && history.length === 0 ? <p>Für diesen Kunden sind bisher keine erneut versendbaren System-E-Mails vorhanden.</p> : null}
      </div>
    </div>
  );
}
