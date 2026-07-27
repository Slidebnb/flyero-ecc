type WarehouseDetails = {
  name: string;
  address: unknown;
  city: string;
  postalCode: string;
  country: string;
  openingHours?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
};

type DistributionSegmentDetails = {
  name: string;
  city?: string | null;
  postalCode?: string | null;
  areaSqm: unknown;
  flyerQuantity?: number | null;
};

export type PaymentConfirmationOrder = {
  id: string;
  orderNumber: string;
  targetAreaName: string;
  city: string;
  postalCode: string;
  flyerQuantity: number;
  estimatedHouseholds?: number | null;
  coverageAreaSqm?: unknown;
  preferredStartDate: Date | string;
  preferredEndDate: Date | string;
  calculatedNetPrice: unknown;
  calculatedVat: unknown;
  calculatedGrossPrice: unknown;
  assignedWarehouse?: WarehouseDetails | null;
  distributionSegments?: DistributionSegmentDetails[];
};

export type PaymentConfirmationInput = {
  customerName: string;
  order: PaymentConfirmationOrder;
  appUrl: string;
};

function formatAddress(value: unknown) {
  const address = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const line1 = [address.street, address.houseNumber].filter(Boolean).join(" ");
  const line2 = [address.postalCode, address.city].filter(Boolean).join(" ");
  const line3 = [address.federalState, address.country].filter(Boolean).join(", ");
  return [line1, line2, line3].filter(Boolean).join("\n") || "-";
}

function formatDate(value?: Date | string | null) {
  return value ? new Intl.DateTimeFormat("de-DE").format(new Date(value)) : "-";
}

function formatCurrency(value: unknown) {
  const amount = numberValue(value);
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number.isFinite(amount) ? amount : 0);
}

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toString" in value) return Number(value.toString());
  return 0;
}

function formatNumber(value: unknown, maximumFractionDigits = 0) {
  const number = numberValue(value);
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits }).format(Number.isFinite(number) ? number : 0);
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function cleanUrl(value: string) {
  return value.replace(/\/$/, "");
}

export function buildPaymentConfirmationEmail(input: PaymentConfirmationInput) {
  const { order } = input;
  const warehouse = order.assignedWarehouse;
  const segments = order.distributionSegments ?? [];
  const orderUrl = `${cleanUrl(input.appUrl)}/customer/orders/${encodeURIComponent(order.id)}`;
  const areaLines = segments.length > 0
    ? segments.map((segment) => {
        const location = [segment.postalCode, segment.city].filter(Boolean).join(" ");
        const quantity = segment.flyerQuantity ? `, ${formatNumber(segment.flyerQuantity)} Flyer` : "";
        return `- ${segment.name}${location ? ` (${location})` : ""}${quantity}`;
      })
    : [`- ${order.targetAreaName || `${order.postalCode} ${order.city}`}`];

  const warehouseAddress = warehouse
    ? formatAddress({
        ...((warehouse.address && typeof warehouse.address === "object") ? warehouse.address : {}),
        postalCode: warehouse.postalCode,
        city: warehouse.city,
        country: warehouse.country === "DE" ? "Deutschland" : warehouse.country,
      })
    : null;

  const warehouseSection = warehouse
    ? [
        "Empfangslager für deine Flyer",
        "Bitte sende deine bereits gedruckten Flyer an dieses Lager:",
        warehouse.name,
        warehouseAddress,
        warehouse.openingHours ? `Annahmezeiten: ${warehouse.openingHours}` : null,
        warehouse.contactPerson ? `Ansprechpartner: ${warehouse.contactPerson}` : null,
        warehouse.contactPhone ? `Telefon: ${warehouse.contactPhone}` : null,
        warehouse.contactEmail ? `E-Mail: ${warehouse.contactEmail}` : null,
        `Bitte gib die Auftragsnummer ${order.orderNumber} als Versandreferenz an.`,
      ].filter((line): line is string => Boolean(line))
    : [
        "Empfangslager für deine Flyer",
        "Die genaue Versandadresse des Empfangslagers wird dir von FLYERO bestätigt, bevor du die Flyer versendest.",
      ];

  const subject = "Zahlung erhalten – deine FLYERO-Verteilung ist bestätigt";
  const body = [
    `Hallo ${input.customerName || ""},`.trim(),
    "",
    `deine Zahlung für den Auftrag ${order.orderNumber} ist eingegangen.`,
    "Dein Auftrag wurde gespeichert und wird von FLYERO weiterbearbeitet.",
    "",
    "Auftragsübersicht",
    `Auftragsnummer: ${order.orderNumber}`,
    `Verteilungszeitraum: ${formatDate(order.preferredStartDate)} bis ${formatDate(order.preferredEndDate)}`,
    `Flyermenge: ${formatNumber(order.flyerQuantity)} Flyer`,
    `Netto: ${formatCurrency(order.calculatedNetPrice)}`,
    `MwSt.: ${formatCurrency(order.calculatedVat)}`,
    `Gesamtbetrag brutto: ${formatCurrency(order.calculatedGrossPrice)}`,
    "",
    "Ausgewählte Gebiete",
    ...areaLines,
    "",
    ...warehouseSection,
    "",
    "Nächste Schritte",
    "Nach Eingang deiner Flyer prüfen wir Menge und Zustand. Anschließend planen wir die Verteilung und stellen die Nachweise in deinem Kundenkonto bereit.",
    `Auftrag im Kundenkonto öffnen: ${orderUrl}`,
    "",
    "Bei Fragen erreichst du uns unter hallo@flyero.org.",
    "Viele Grüße",
    "dein FLYERO-Team",
  ].join("\n");

  const htmlAreaRows = areaLines.map((line) => `<li style="margin:0 0 7px;">${escapeHtml(line.replace(/^-\s*/, ""))}</li>`).join("");
  const htmlWarehouse = warehouse
    ? `<div style="margin:24px 0;padding:20px;background:#f3f8ef;border:1px solid #dcebd3;border-radius:14px;">
        <div style="color:#5b705d;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Empfangslager</div>
        <div style="margin-top:7px;font-size:18px;font-weight:800;color:#172019;">${escapeHtml(warehouse.name)}</div>
        <div style="margin-top:6px;color:#4b5a4d;white-space:pre-line;">${escapeHtml(warehouseAddress)}</div>
        ${warehouse.openingHours ? `<div style="margin-top:10px;color:#4b5a4d;">Annahmezeiten: ${escapeHtml(warehouse.openingHours)}</div>` : ""}
        ${warehouse.contactPhone ? `<div style="margin-top:4px;color:#4b5a4d;">Telefon: ${escapeHtml(warehouse.contactPhone)}</div>` : ""}
        <div style="margin-top:14px;color:#4b5a4d;line-height:1.5;">Bitte gib beim Versand die Auftragsnummer <strong>${escapeHtml(order.orderNumber)}</strong> an.</div>
      </div>`
    : `<div style="margin:24px 0;padding:20px;background:#f7f8f6;border:1px solid #e1e7df;border-radius:14px;color:#4b5a4d;">Die Versandadresse des Empfangslagers wird dir von FLYERO bestätigt, bevor du deine Flyer versendest.</div>`;
  const greeting = input.customerName ? `Hallo ${escapeHtml(input.customerName)},` : "Hallo,";
  const html = `<!doctype html>
<html lang="de">
  <body style="margin:0;background:#eef3ed;color:#172019;font-family:Arial,Helvetica,sans-serif;">
    <div style="padding:32px 16px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dce5d9;border-radius:18px;overflow:hidden;">
        <div style="padding:28px 32px;background:#101713;color:#ffffff;">
          <div style="font-size:25px;font-weight:800;letter-spacing:.06em;">FLYERO</div>
          <div style="margin-top:8px;color:#b7ff21;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Zahlung erhalten</div>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 18px;font-size:16px;">${greeting}</p>
          <h1 style="margin:0 0 14px;font-size:30px;line-height:1.15;color:#101713;">Deine Bestellung ist bestätigt</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4b5a4d;">Deine Zahlung ist eingegangen. Deine FLYERO-Verteilung wurde gespeichert und wird jetzt für die Durchführung vorbereitet.</p>
          <div style="padding:19px 20px;background:#f3f8ef;border-radius:14px;">
            <div style="display:inline-block;width:49%;vertical-align:top;color:#617064;font-size:12px;">AUFTRAG<br /><strong style="display:inline-block;margin-top:5px;color:#172019;font-size:17px;">${escapeHtml(order.orderNumber)}</strong></div>
            <div style="display:inline-block;width:49%;vertical-align:top;color:#617064;font-size:12px;">FLYERMENGE<br /><strong style="display:inline-block;margin-top:5px;color:#172019;font-size:17px;">${escapeHtml(formatNumber(order.flyerQuantity))} Flyer</strong></div>
            <div style="margin-top:16px;color:#617064;font-size:12px;">VERTEILUNGSZEITRAUM<br /><strong style="display:inline-block;margin-top:5px;color:#172019;font-size:15px;">${escapeHtml(formatDate(order.preferredStartDate))} bis ${escapeHtml(formatDate(order.preferredEndDate))}</strong></div>
          </div>
          <div style="margin-top:24px;color:#172019;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Ausgewählte Gebiete</div>
          <ul style="margin:12px 0 0;padding-left:20px;color:#4b5a4d;font-size:15px;line-height:1.5;">${htmlAreaRows}</ul>
          <div style="margin-top:24px;padding:18px 20px;border:1px solid #e1e7df;border-radius:14px;">
            <div style="color:#617064;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Auftragswert</div>
            <div style="margin-top:10px;color:#4b5a4d;line-height:1.7;">Netto: <strong>${escapeHtml(formatCurrency(order.calculatedNetPrice))}</strong><br />MwSt.: <strong>${escapeHtml(formatCurrency(order.calculatedVat))}</strong><br /><span style="font-size:18px;color:#172019;">Gesamtbetrag: <strong>${escapeHtml(formatCurrency(order.calculatedGrossPrice))}</strong></span></div>
          </div>
          ${htmlWarehouse}
          <a href="${escapeHtml(orderUrl)}" style="display:inline-block;padding:15px 22px;background:#b7ff21;color:#101713;border-radius:10px;font-size:16px;font-weight:800;text-decoration:none;">Auftrag im Kundenkonto öffnen</a>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#647166;">Nach Eingang deiner Flyer prüfen wir Menge und Zustand. Anschließend planen wir die Verteilung und stellen die Nachweise in deinem Kundenkonto bereit.</p>
        </div>
        <div style="padding:20px 32px;background:#f7faf6;border-top:1px solid #e3ebe1;color:#647166;font-size:13px;line-height:1.5;">Viele Grüße<br /><strong style="color:#172019;">dein FLYERO-Team</strong><br /><a href="mailto:hallo@flyero.org" style="color:#4b6b45;">hallo@flyero.org</a></div>
      </div>
    </div>
  </body>
</html>`;

  return {
    subject,
    body,
    data: {
      orderNumber: order.orderNumber,
      customerName: input.customerName,
      areaName: order.targetAreaName,
      city: order.city,
      postalCode: order.postalCode,
      flyerQuantity: order.flyerQuantity,
      warehouseName: warehouse?.name ?? null,
      warehouseAddress,
      netAmount: formatCurrency(order.calculatedNetPrice),
      vatAmount: formatCurrency(order.calculatedVat),
      grossAmount: formatCurrency(order.calculatedGrossPrice),
      campaignUrl: orderUrl,
      nextStep: "Flyer an das Empfangslager senden",
    },
    html,
  };
}
