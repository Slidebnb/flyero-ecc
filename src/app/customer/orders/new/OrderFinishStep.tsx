"use client";

import { Download, Mail } from "lucide-react";
import type { OnlineServiceType } from "@/lib/serviceCatalog";

type OrderFinishStepProps = {
  flyerSource: string;
  effectiveWeightClass: string;
  serviceType: OnlineServiceType;
  isFinishing: boolean;
  finishStatus: string;
  inquiryFormHref: string;
  inquiryMailHref: string;
  onFinish: (completionPath: "direct_payment" | "inquiry") => void;
};

export function OrderFinishStep({
  flyerSource,
  effectiveWeightClass,
  serviceType,
  isFinishing,
  finishStatus,
  inquiryFormHref,
  inquiryMailHref,
  onFinish,
}: OrderFinishStepProps) {
  const sampling = serviceType === "PRODUCT_SAMPLING";

  return (
    <section className="orderPanelBlock inlineStepBlock" data-testid="order-completion-step">
      <p className="orderStepHint">Fast geschafft. Prüfe deine Angaben und entscheide, wie du fortfahren möchtest.</p>
      <div className="orderFinishChoices">
        {flyerSource === "CUSTOMER_OWN" && effectiveWeightClass !== "CUSTOM" && !sampling ? (
          <button data-testid="order-finish-direct" type="button" className="finishPrimary" disabled={isFinishing} onClick={() => onFinish("direct_payment")}>
            Jetzt buchen und bezahlen
            <small>Auftrag anlegen und sicher zur Zahlung weitergehen.</small>
          </button>
        ) : null}
        <button data-testid="order-finish-inquiry" type="button" disabled={isFinishing} onClick={() => onFinish("inquiry")}>
          {sampling ? "Individuelles Sampling-Angebot anfragen" : "Unverbindlich anfragen"}
          <small>{sampling
            ? "Gewicht, Verpackung, Lagerung und Übergabe werden vorab geprüft."
            : "Wir prüfen Gebiet, Zustellbarkeit und deine Flyer und melden uns schnell."}</small>
        </button>
        <a href={inquiryFormHref} download>
          <Download aria-hidden="true" />
          Anfrageformular herunterladen
        </a>
        <a href={inquiryMailHref}>
          <Mail aria-hidden="true" />
          Per E-Mail anfragen
        </a>
      </div>
      <p className="orderReviewNotice">Deine Flyer sind bereits gedruckt. Nach der Verteilung erhältst du GPS-Nachweis, Foto-Dokumentation und PDF-Bericht.</p>
      {finishStatus ? <p className="finishStatus" role="status">{finishStatus}</p> : null}
    </section>
  );
}
