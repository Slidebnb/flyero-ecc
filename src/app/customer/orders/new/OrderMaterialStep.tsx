"use client";

import { distributionServiceCatalog, type OnlineServiceType, type ServiceCatalogItem } from "@/lib/serviceCatalog";
import type { CustomerWarehouse } from "./orderWizardTypes";

type SamplingDetails = {
  size: string;
  packaging: string;
  fragile: boolean;
  personalHandover: boolean;
  storage: string;
};

type OrderMaterialStepProps = {
  isPublicPlanner: boolean;
  serviceType: OnlineServiceType;
  selectedService: ServiceCatalogItem;
  productFormat: string;
  weightInGrams: string;
  numericWeightInGrams?: number;
  effectiveWeightClass: string;
  samplingDetails: SamplingDetails;
  repeatPrintChoice: "pending" | "same" | "changed" | null;
  warehouseOptionsStatus: "loading" | "ready" | "error";
  warehouseOptions: CustomerWarehouse[];
  selectedWarehouseId: string;
  recommendedFlyerQuantity: number;
  flyerQuantity: number;
  onServiceTypeChange: (serviceType: OnlineServiceType) => void;
  onProductFormatChange: (format: string) => void;
  onWeightChange: (value: string) => void;
  onSamplingDetailsChange: (details: SamplingDetails) => void;
  onRepeatPrintChoice: (choice: "same" | "changed") => void;
  onWarehouseChange: (warehouseId: string) => void;
  onMoveQuantity: (delta: number) => void;
  onQuantityChange: (quantity: number) => void;
  onQuantityBlur: () => void;
};

export function OrderMaterialStep({
  isPublicPlanner,
  serviceType,
  selectedService,
  productFormat,
  weightInGrams,
  numericWeightInGrams,
  effectiveWeightClass,
  samplingDetails,
  repeatPrintChoice,
  warehouseOptionsStatus,
  warehouseOptions,
  selectedWarehouseId,
  recommendedFlyerQuantity,
  flyerQuantity,
  onServiceTypeChange,
  onProductFormatChange,
  onWeightChange,
  onSamplingDetailsChange,
  onRepeatPrintChoice,
  onWarehouseChange,
  onMoveQuantity,
  onQuantityChange,
  onQuantityBlur,
}: OrderMaterialStepProps) {
  return (
    <section className="orderPanelBlock inlineStepBlock" data-testid="customer-own-flyer-step">
      <p className="orderStepHint">Wähle zuerst, welches Werbemittel du verteilen lassen möchtest. Online buchbar sind bereits gedruckte Materialien, die an ein FLYERO-Lager gesendet werden.</p>
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
      <p className="orderReviewNotice">Du sendest deine fertigen Materialien nach der Buchung an das ausgewählte Lager. Den Druck selbst übernimmt FLYERO in diesem Online-Ablauf nicht.</p>
      <label className="selectLine">
        <span>Format</span>
        <select data-testid="order-product-format" value={productFormat} onChange={(event) => onProductFormatChange(event.target.value)}>
          {selectedService.formatOptions.map((format) => <option key={format} value={format}>{format}</option>)}
        </select>
        <small>Wähle das Format, das du bereits gedruckt an das Lager sendest.</small>
      </label>
      <label className="selectLine">
        <span>Ungefähres Einzelgewicht</span>
        <input type="number" min="1" max="10000" inputMode="numeric" value={weightInGrams} onChange={(event) => onWeightChange(event.target.value)} placeholder="z. B. 35" />
        <small>{numericWeightInGrams ? `Gewichtsklasse: ${effectiveWeightClass === "CUSTOM" ? "individuelles Angebot" : effectiveWeightClass}` : "Optional. Ohne Angabe kalkulieren wir mit LIGHT."}</small>
      </label>
      {effectiveWeightClass === "CUSTOM" ? (
        <p className="orderReviewNotice" role="status">
          Bei mehr als 250 g prüfen wir die sichere Zustellung persönlich. Eine direkte Zahlung ist für dieses Gewicht nicht verfügbar; sende uns bitte zuerst eine unverbindliche Anfrage.
        </p>
      ) : null}
      {serviceType === "PRODUCT_SAMPLING" ? (
        <div className="samplingDetails" data-testid="sampling-details">
          <strong>Angaben zur Produktprobe</strong>
          <label>Größe<input value={samplingDetails.size} onChange={(event) => onSamplingDetailsChange({ ...samplingDetails, size: event.target.value })} placeholder="z. B. 10 ml oder 8 x 5 cm" /></label>
          <label>Verpackung<input value={samplingDetails.packaging} onChange={(event) => onSamplingDetailsChange({ ...samplingDetails, packaging: event.target.value })} placeholder="z. B. Beutel, Karton oder Fläschchen" /></label>
          <label>Lagerbedingungen<input value={samplingDetails.storage} onChange={(event) => onSamplingDetailsChange({ ...samplingDetails, storage: event.target.value })} placeholder="z. B. trocken lagern" /></label>
          <label className="checkLine"><input type="checkbox" checked={samplingDetails.fragile} onChange={(event) => onSamplingDetailsChange({ ...samplingDetails, fragile: event.target.checked })} />Empfindlich oder zerbrechlich</label>
          <label className="checkLine"><input type="checkbox" checked={samplingDetails.personalHandover} onChange={(event) => onSamplingDetailsChange({ ...samplingDetails, personalHandover: event.target.checked })} />Persönliche Übergabe erforderlich</label>
        </div>
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
      {!isPublicPlanner ? (
        <label className="selectLine">
          <span>Empfangslager für deine Flyer</span>
          <select data-testid="order-warehouse-select" value={selectedWarehouseId} onChange={(event) => onWarehouseChange(event.target.value)} disabled={warehouseOptionsStatus === "loading"}>
            <option value="">{warehouseOptionsStatus === "loading" ? "Lager werden geladen ..." : "Lager auswählen"}</option>
            {warehouseOptions.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} · {warehouse.postalCode} {warehouse.city}</option>)}
          </select>
          <small>Du sendest die bereits gedruckten Flyer nach der Buchung an dieses Lager.{warehouseOptionsStatus === "error" ? " Die Lager konnten gerade nicht geladen werden." : ""}</small>
        </label>
      ) : (
        <p className="orderReviewNotice">Nach deiner Registrierung wählst du das Empfangslager für deine bereits gedruckten Flyer aus.</p>
      )}
      <div className="flyerRecommendation">
        <span>Unser Vorschlag</span>
        <strong>{new Intl.NumberFormat("de-DE").format(Math.round(recommendedFlyerQuantity || 0))} Stück mit 10 % Reserve</strong>
        <small>Du kannst die Menge jederzeit ändern.</small>
      </div>
      <div className="quantityControl">
        <button type="button" onClick={() => onMoveQuantity(-1000)}>−</button>
        <input data-testid="order-flyer-quantity" value={flyerQuantity} onChange={(event) => onQuantityChange(Number(event.target.value) || 100)} onBlur={onQuantityBlur} inputMode="numeric" />
        <button type="button" onClick={() => onMoveQuantity(1000)}>+</button>
        <span>Stück</span>
      </div>
    </section>
  );
}
