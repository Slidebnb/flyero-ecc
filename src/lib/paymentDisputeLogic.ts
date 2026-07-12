export type PaymentDisputeStatus = "OPEN" | "WON" | "LOST" | "CLOSED";

export type StripeDisputeEventInput = {
  type: string;
  status?: string | null;
};

export function disputeStatusFromStripeStatus(status?: string | null): PaymentDisputeStatus {
  if (status === "won") return "WON";
  if (status === "lost") return "LOST";
  if (status === "closed" || status?.endsWith("_closed") || status === "charge_refunded") return "CLOSED";
  return "OPEN";
}

export function classifyStripeDisputeEvent(input: StripeDisputeEventInput) {
  const status = disputeStatusFromStripeStatus(input.status);
  const customerMessage = status === "OPEN"
    ? "Eine Zahlung wird von Stripe geprüft."
    : status === "WON"
      ? "Die Zahlungsprüfung wurde zugunsten von FLYERO abgeschlossen."
      : status === "LOST"
        ? "Die Zahlungsprüfung wurde zugunsten des Karteninhabers abgeschlossen."
        : "Die Zahlungsprüfung wurde abgeschlossen.";

  return { status, customerMessage };
}

export function isRefundBlockedByDispute(status: string) {
  return status === "OPEN";
}
