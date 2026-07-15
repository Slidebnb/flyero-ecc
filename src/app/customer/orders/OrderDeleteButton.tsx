"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

type Props = {
  orderId: string;
  orderLabel: string;
};

export function OrderDeleteButton({ orderId, orderLabel }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function deleteOrder() {
    if (busy || !window.confirm(`Möchtest du ${orderLabel} wirklich löschen?`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/customer/orders/${encodeURIComponent(orderId)}`, {
        method: "DELETE",
        headers: { accept: "application/json" },
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Die Kampagne konnte nicht gelöscht werden.");
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Die Kampagne konnte nicht gelöscht werden. Bitte versuche es erneut.");
      setBusy(false);
    }
  }

  return (
    <span className="customerOrderDeleteAction">
      <button type="button" className="secondaryButton" onClick={deleteOrder} disabled={busy}>
        <Trash2 aria-hidden="true" size={15} />
        {busy ? "Wird gelöscht ..." : "Löschen"}
      </button>
      {error ? <small role="alert">{error}</small> : null}
    </span>
  );
}
