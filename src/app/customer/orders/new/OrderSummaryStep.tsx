"use client";

import type { ServiceCatalogItem } from "@/lib/serviceCatalog";
import type { CustomerWarehouse } from "./orderWizardTypes";

type OrderSummaryStepProps = {
  postalCode: string;
  city: string;
  coverageAreaSqm: number;
  service: ServiceCatalogItem;
  flyerQuantity: number;
  priceReady: boolean;
  netPrice: string | number;
  vatAmount: string | number;
  grossPrice: string | number;
  pricePreviewText: string;
  selectedWarehouse?: CustomerWarehouse;
  warehouseLabel: string;
  dataBasisLabel: string;
  notice: string;
  contactPerson: string;
  contactPhone: string;
  notes: string;
  onContactPersonChange: (value: string) => void;
  onContactPhoneChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  formatNumber: (value: number) => string;
  formatCurrency: (value: string | number) => string;
};

export function OrderSummaryStep({
  postalCode,
  city,
  coverageAreaSqm,
  service,
  flyerQuantity,
  priceReady,
  netPrice,
  vatAmount,
  grossPrice,
  pricePreviewText,
  selectedWarehouse,
  warehouseLabel,
  dataBasisLabel,
  notice,
  contactPerson,
  contactPhone,
  notes,
  onContactPersonChange,
  onContactPhoneChange,
  onNotesChange,
  formatNumber,
  formatCurrency,
}: OrderSummaryStepProps) {
  const areaLabel = (coverageAreaSqm / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 2 });

  return (
    <section className="orderPanelBlock inlineStepBlock" data-testid="customer-own-flyer-summary">
      <div className="summaryMiniGrid">
        <span><strong>{postalCode} {city}</strong>Gebiet</span>
        <span><strong>{areaLabel} km²</strong>Fläche</span>
        <span><strong>{service.label}</strong>Werbemittel</span>
        <span><strong>{formatNumber(flyerQuantity)}</strong>Stück</span>
        <span data-testid="order-price-net"><strong>{priceReady ? formatCurrency(netPrice) : pricePreviewText}</strong>Preis netto</span>
        <span><strong>{priceReady ? formatCurrency(vatAmount) : pricePreviewText}</strong>Umsatzsteuer</span>
        <span className="summaryTotal"><strong>{priceReady ? formatCurrency(grossPrice) : pricePreviewText}</strong>Gesamt brutto</span>
        <span><strong>{selectedWarehouse?.name ?? warehouseLabel}</strong>Empfangslager</span>
      </div>
      <p className="orderReviewNotice">{notice}</p>
      <p className="overviewDataBasis">{dataBasisLabel}</p>
      <div className="proofIncludedList">
        <span>GPS-Nachweis nach der Verteilung</span>
        <span>Foto-Dokumentation nach der Verteilung</span>
        <span>PDF-Bericht nach Abschluss</span>
      </div>
      <details className="orderDetails inlineDetails">
        <summary>Kontakt & Hinweise</summary>
        <label>Kontaktperson<input value={contactPerson} onChange={(event) => onContactPersonChange(event.target.value)} /></label>
        <label>Telefon<input value={contactPhone} onChange={(event) => onContactPhoneChange(event.target.value)} /></label>
        <label>Hinweise<textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} /></label>
      </details>
    </section>
  );
}
