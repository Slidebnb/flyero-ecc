"use client";

import { useState } from "react";

export function WarehouseDeleteButton({ id, name }: { id: string; name: string }) {
  const [busy, setBusy] = useState(false);

  async function removeWarehouse() {
    if (!window.confirm(`Soll das Lager „${name}“ wirklich gelöscht werden? Historische Lager mit Verknüpfungen können nur deaktiviert werden.`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/settings/warehouses/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Das Lager konnte nicht gelöscht werden.");
      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Das Lager konnte nicht gelöscht werden.");
      setBusy(false);
    }
  }

  return (
    <button type="button" className="dangerButton" onClick={removeWarehouse} disabled={busy}>
      {busy ? "Wird gelöscht …" : "Lager löschen"}
    </button>
  );
}
