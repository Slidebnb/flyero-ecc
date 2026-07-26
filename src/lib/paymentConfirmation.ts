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

function formatArea(value: unknown) {
  return `${formatNumber(numberValue(value) / 1_000_000, 2)} km²`;
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
        return `- ${segment.name}${location ? ` (${location})` : ""}: ${formatArea(segment.areaSqm)}${quantity}`;
      })
    : [`- ${order.targetAreaName || `${order.postalCode} ${order.city}`}: ${formatArea(order.coverageAreaSqm)}`];

  const warehouseSection = warehouse
    ? [
        "Empfangslager für deine Flyer",
        "Bitte sende deine bereits gedruckten Flyer an dieses Lager:",
        warehouse.name,
        formatAddress({
          ...((warehouse.address && typeof warehouse.address === "object") ? warehouse.address : {}),
          postalCode: warehouse.postalCode,
          city: warehouse.city,
          country: warehouse.country === "DE" ? "Deutschland" : warehouse.country,
        }),
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
    `Gebietsfläche: ${formatArea(order.coverageAreaSqm)}`,
    `Haushalte: ca. ${formatNumber(order.estimatedHouseholds)} (Schätzung)`,
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
      warehouseAddress: warehouse ? formatAddress(warehouse.address) : null,
      netAmount: formatCurrency(order.calculatedNetPrice),
      vatAmount: formatCurrency(order.calculatedVat),
      grossAmount: formatCurrency(order.calculatedGrossPrice),
      campaignUrl: orderUrl,
      nextStep: "Flyer an das Empfangslager senden",
    },
  };
}
