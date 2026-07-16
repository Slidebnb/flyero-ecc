"use client";

import { useState } from "react";

type ServiceOption = { value: string; label: string };

export function PricingSimulationForm({ services }: { services: ServiceOption[] }) {
  const [serviceType, setServiceType] = useState(services[0]?.value ?? "FLYER_STANDARD");
  const [quantity, setQuantity] = useState("5000");
  const [weightInGrams, setWeightInGrams] = useState("20");
  const [areaDifficulty, setAreaDifficulty] = useState("NORMAL");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function simulate() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/settings/pricing/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceType, quantity: Number(quantity), weightInGrams: Number(weightInGrams), areaDifficulty }),
      });
      const payload = await response.json() as { data?: Record<string, unknown>; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Preisvorschau konnte nicht berechnet werden.");
      setResult(payload.data ?? null);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "Preisvorschau konnte nicht berechnet werden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel stack">
      <div>
        <p className="eyebrow">Kontrolle vor Aktivierung</p>
        <h2>Preisvorschau</h2>
        <p className="sectionIntro">Pruefe dieselbe serverseitige Berechnung, die im Auftrag und im Checkout verwendet wird.</p>
      </div>
      <div className="formGrid">
        <label>Leistung<select value={serviceType} onChange={(event) => setServiceType(event.target.value)}>{services.map((service) => <option key={service.value} value={service.value}>{service.label}</option>)}</select></label>
        <label>Menge<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
        <label>Gewicht je Einheit (g)<input type="number" min="0" value={weightInGrams} onChange={(event) => setWeightInGrams(event.target.value)} /></label>
        <label>Gebietsart<select value={areaDifficulty} onChange={(event) => setAreaDifficulty(event.target.value)}><option value="NORMAL">Normal</option><option value="MIXED">Gemischt</option><option value="LOW_DENSITY">Dünn besiedelt</option><option value="RURAL">Ländlich</option><option value="HARD">Anspruchsvoll</option></select></label>
      </div>
      <button type="button" onClick={simulate} disabled={loading}>{loading ? "Wird berechnet ..." : "Preisvorschau aktualisieren"}</button>
      {error ? <p role="alert" className="errorText">{error}</p> : null}
      {result ? <div className="formGrid" aria-live="polite">
        <div><strong>Netto</strong><p>{String(result.calculatedNet)} EUR</p></div>
        <div><strong>MwSt.</strong><p>{String(result.vatAmount)} EUR</p></div>
        <div><strong>Brutto</strong><p>{String(result.calculatedGross)} EUR</p></div>
        <div><strong>Grenzprüfung</strong><p>{String(result.boundaryCheck) === "passed" ? "Bestanden" : "Prüfung erforderlich"}</p></div>
        <div><strong>Checkout</strong><p>{result.checkoutAllowed ? "Online möglich" : "Manuelle Prüfung"}</p></div>
        <div><strong>Version</strong><p>{String(result.pricingVersion)}</p></div>
      </div> : null}
    </section>
  );
}
