"use client";

import { distributionServiceCatalog, type OnlineServiceType, type ServiceCatalogItem } from "@/lib/serviceCatalog";

type OrderMaterialStepProps = {
  serviceType: OnlineServiceType;
  selectedService: ServiceCatalogItem;
  repeatPrintChoice: "pending" | "same" | "changed" | null;
  recommendedFlyerQuantity: number | null;
  recommendationLabel: string;
  flyerQuantity: number;
  onServiceTypeChange: (serviceType: OnlineServiceType) => void;
  onRepeatPrintChoice: (choice: "same" | "changed") => void;
  onMoveQuantity: (delta: number) => void;
  onQuantityChange: (quantity: number) => void;
  onQuantityBlur: () => void;
};

export function OrderMaterialStep({
  serviceType,
  selectedService,
  repeatPrintChoice,
  recommendedFlyerQuantity,
  recommendationLabel,
  flyerQuantity,
  onServiceTypeChange,
  onRepeatPrintChoice,
  onMoveQuantity,
  onQuantityChange,
  onQuantityBlur,
}: OrderMaterialStepProps) {
  return (
    <section className="orderPanelBlock inlineStepBlock" data-testid="customer-own-flyer-step">
      <p className="orderStepHint">Wähle dein Werbemittel und die gewünschte Menge. Deine gedruckten Materialien sendest du nach der Buchung an das passende FLYERO-Lager.</p>
      <div className="flyerQuantityIntro">
        <strong>Wie viele Flyer sollen verteilt werden?</strong>
        <small>Die Menge gilt für deine gesamte Kampagne. Bei mehreren Teilgebieten wird sie anschließend auf die Gebiete verteilt.</small>
        <div className="flyerRecommendation">
          <span>{recommendationLabel}</span>
          <strong>{recommendedFlyerQuantity == null ? "Noch nicht verfügbar" : `${new Intl.NumberFormat("de-DE").format(Math.round(recommendedFlyerQuantity))} Stück`}</strong>
          <small>{recommendedFlyerQuantity == null ? "Bitte lege die gewünschte Menge selbst fest." : "Empfehlung aus geprüften Gebietsdaten."}</small>
        </div>
        <div className="quantityControl">
          <button type="button" onClick={() => onMoveQuantity(-1000)}>−</button>
          <input data-testid="order-flyer-quantity" value={flyerQuantity > 0 ? flyerQuantity : ""} onChange={(event) => { const rawValue = event.target.value.trim(); const parsedValue = rawValue ? Number(rawValue) : 0; onQuantityChange(Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0); }} onBlur={onQuantityBlur} inputMode="numeric" aria-label="Flyermenge" placeholder="1.000" />
          <button type="button" onClick={() => onMoveQuantity(1000)}>+</button>
          <span>Stück</span>
        </div>
        <small className="quantityControlHint">Ab 1.000 Stück · weitere Mengen einfach über + auswählen</small>
      </div>
      <div className="serviceChoiceList" aria-label="Werbemittel auswählen" data-testid="order-service-type">
        {distributionServiceCatalog.map((service) => (
          <button
            key={service.serviceType}
            type="button"
            className={serviceType === service.serviceType ? "serviceChoice isSelected" : "serviceChoice"}
            aria-pressed={serviceType === service.serviceType}
            onClick={() => onServiceTypeChange(service.serviceType)}
          >
            <span className="serviceChoiceMarker" aria-hidden="true" />
            <span>
              <strong>{service.label}</strong>
              <small>{service.description}</small>
            </span>
          </button>
        ))}
      </div>
      {serviceType === "PRODUCT_SAMPLING" ? (
        <p className="orderReviewNotice" data-testid="sampling-manual-review" role="status">{selectedService.label} prüfen wir vorab persönlich. Bitte sende dafür eine unverbindliche Anfrage; die Details klären wir direkt mit dir.</p>
      ) : null}
      {repeatPrintChoice === "pending" ? (
        <div className="repeatPrintNotice" role="alert">
          <strong>Ist deine Flyerauflage noch aktuell?</strong>
          <p>Gebiet und Flyerzahl wurden von deiner letzten Kampagne übernommen.</p>
          <div className="repeatPrintActions">
            <button type="button" className="primaryButton" onClick={() => onRepeatPrintChoice("same")}>Ja, ich sende dieselben Flyer</button>
            <button type="button" className="secondaryButton" onClick={() => onRepeatPrintChoice("changed")}>Nein, ich sende neue Flyer</button>
          </div>
        </div>
      ) : null}
      <p className="orderReviewNotice">Deine bereits gedruckten Materialien sendest du nach der Buchung an das automatisch zugewiesene FLYERO-Hauptlager. Die genaue Lieferadresse erhältst du direkt nach der Auftragserstellung.</p>
    </section>
  );
}
