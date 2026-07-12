export type ReconciliationLocalStatus =
  | "CREATED"
  | "CHECKOUT_CREATED"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export type ReconciliationRemoteSnapshot = {
  status: string;
  amountMinor: number | null;
  currency: string | null;
  paymentStatus?: string | null;
};

export type ReconciliationLocalSnapshot = {
  status: ReconciliationLocalStatus;
  amountMinor: number;
  currency: string;
};

export type ReconciliationComparison = {
  result: "MATCH" | "MISMATCH";
  amountMismatch: boolean;
  currencyMismatch: boolean;
  statusMismatch: boolean;
  details: Record<string, unknown>;
};

function remotePaid(remote: ReconciliationRemoteSnapshot) {
  return remote.status === "succeeded" || remote.paymentStatus === "paid";
}

function localPaid(status: ReconciliationLocalStatus) {
  return ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(status);
}

export function comparePaymentSnapshot(
  local: ReconciliationLocalSnapshot,
  remote: ReconciliationRemoteSnapshot,
): ReconciliationComparison {
  const amountMismatch = remote.amountMinor !== null && remote.amountMinor !== local.amountMinor;
  const currencyMismatch = Boolean(remote.currency && remote.currency.toUpperCase() !== local.currency.toUpperCase());
  const statusMismatch = localPaid(local.status) !== remotePaid(remote);
  const result = amountMismatch || currencyMismatch || statusMismatch ? "MISMATCH" : "MATCH";

  return {
    result,
    amountMismatch,
    currencyMismatch,
    statusMismatch,
    details: {
      localStatus: local.status,
      remoteStatus: remote.status,
      remotePaymentStatus: remote.paymentStatus ?? null,
      localAmountMinor: local.amountMinor,
      remoteAmountMinor: remote.amountMinor,
      localCurrency: local.currency,
      remoteCurrency: remote.currency,
    },
  };
}
