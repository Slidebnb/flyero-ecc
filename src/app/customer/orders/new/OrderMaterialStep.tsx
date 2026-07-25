"use client";

import { distributionServiceCatalog, type OnlineServiceType, type ServiceCatalogItem } from "@/lib/serviceCatalog";

type OrderMaterialStepProps = {
  serviceType: OnlineServiceType;
  selectedService: ServiceCatalogItem;
  repeatPrintChoice: "pending" | "same" | "changed" | null;
  recommendedFlyerQuantity: number;
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
      <p className="orderStepHint">Wähle zuerst, welches Werbemittel du verteilen lassen möchtest. Online buchbar sind bereits gedruckte Materialien, die an ein FLYERO-Lager gesendet werden.</p>
      <div className="flyerQuantityIntro">
        <strong>Wie viele Stück möchtest du verteilen?</strong>
        <small>Die Menge kannst du jederzeit anpassen. FLYERO zeigt dir direkt die passende Preisvorschau.</small>
        <div className="flyerRecommendation">
          <span>{recommendationLabel}</span>
          <strong>{new Intl.NumberFormat("de-DE").format(Math.round(recommendedFlyerQuantity || 0))} Stück</strong>
          <small>Empfehlung auf Basis deines ausgewählten Gebiets.</small>
        </div>
        <div className="quantityControl">
          <button type="button" onClick={() => onMoveQuantity(-1000)}>−</button>
          <input data-testid="order-flyer-quantity" value={flyerQuantity} onChange={(event) => onQuantityChange(Number(event.target.value) || 100)} onBlur={onQuantityBlur} inputMode="numeric" aria-label="Flyermenge" />
          <button type="button" onClick={() => onMoveQuantity(1000)}>+</button>
          <span>Stück</span>
        </div>
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
