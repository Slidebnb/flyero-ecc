import { buildCustomerEmail } from "./customerEmailTemplate.ts";

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

function cleanUrl(value: string) {
  return value.replace(/\/$/, "");
}

function warehouseDetails(warehouse: WarehouseDetails | null | undefined, orderNumber: string) {
  if (!warehouse) {
    return {
      value: "Die genaue Versandadresse des Empfangslagers wird Ihnen von FLYERO best\u00e4tigt, bevor Sie die Flyer versenden.",
      note: null,
    };
  }
  const address = formatAddress({
    ...((warehouse.address && typeof warehouse.address === "object") ? warehouse.address : {}),
    postalCode: warehouse.postalCode,
    city: warehouse.city,
    country: warehouse.country === "DE" ? "Deutschland" : warehouse.country,
  });
  const contact = [
    warehouse.openingHours ? `Annahmezeiten: ${warehouse.openingHours}` : null,
    warehouse.contactPerson ? `Ansprechpartner: ${warehouse.contactPerson}` : null,
    warehouse.contactPhone ? `Telefon: ${warehouse.contactPhone}` : null,
    warehouse.contactEmail ? `E-Mail: ${warehouse.contactEmail}` : null,
  ].filter((line): line is string => Boolean(line));
  return {
    value: [warehouse.name, address, ...contact].join("\n"),
    note: `Bitte geben Sie beim Versand die Auftragsnummer ${orderNumber} als Versandreferenz an.`,
  };
}

export function buildPaymentConfirmationEmail(input: PaymentConfirmationInput) {
  const { order } = input;
  const segments = order.distributionSegments ?? [];
  const orderUrl = `${cleanUrl(input.appUrl)}/customer/orders/${encodeURIComponent(order.id)}`;
  const areaLines = segments.length > 0
    ? segments.map((segment) => {
        const location = [segment.postalCode, segment.city].filter(Boolean).join(" ");
        const quantity = segment.flyerQuantity ? `, ${formatNumber(segment.flyerQuantity)} Flyer` : "";
        return `${segment.name}${location ? ` (${location})` : ""}${quantity}`;
      })
    : [order.targetAreaName || `${order.postalCode} ${order.city}`];
  const warehouse = warehouseDetails(order.assignedWarehouse, order.orderNumber);
  const warehouseLabel = order.assignedWarehouse ? "Empfangslager f\u00fcr Ihre Flyer" : "Empfangslager";
  const warehouseContent = order.assignedWarehouse
    ? `${warehouse.value}\n${warehouse.note}`
    : warehouse.value;
  const subject = "Ihre Zahlung ist eingegangen - Ihre FLYERO-Verteilung ist best\u00e4tigt";
  const email = buildCustomerEmail({
    subject,
    eyebrow: "ZAHLUNG ERHALTEN",
    title: "Ihre Bestellung ist best\u00e4tigt",
    customerName: input.customerName,
    intro: `Ihre Zahlung f\u00fcr den Auftrag ${order.orderNumber} ist eingegangen. Ihre FLYERO-Verteilung wurde gespeichert und wird jetzt f\u00fcr die Durchf\u00fchrung vorbereitet.`,
    content: [
      "Auftrags\u00fcbersicht",
      `Verteilungszeitraum: ${formatDate(order.preferredStartDate)} bis ${formatDate(order.preferredEndDate)}`,
      `Flyermenge: ${formatNumber(order.flyerQuantity)} Flyer`,
      `Ausgew\u00e4hlte Gebiete: ${areaLines.join(" | ")}`,
      `Netto: ${formatCurrency(order.calculatedNetPrice)}`,
      `MwSt.: ${formatCurrency(order.calculatedVat)}`,
      `Gesamtbetrag: ${formatCurrency(order.calculatedGrossPrice)}`,
    ].join("\n"),
    details: [
      { label: warehouseLabel, value: warehouseContent },
    ],
    action: { label: "Auftrag im Kundenkonto \u00f6ffnen", url: orderUrl },
    note: "Nach Eingang Ihrer Flyer pr\u00fcfen wir Menge und Zustand. Anschlie\u00dfend planen wir die Verteilung und stellen die Nachweise in Ihrem Kundenkonto bereit.",
  });

  return {
    subject: email.subject,
    body: email.text,
    data: {
      orderNumber: order.orderNumber,
      customerName: input.customerName,
      areaName: order.targetAreaName,
      city: order.city,
      postalCode: order.postalCode,
      flyerQuantity: order.flyerQuantity,
      warehouseName: order.assignedWarehouse?.name ?? null,
      warehouseAddress: order.assignedWarehouse ? warehouse.value : null,
      netAmount: formatCurrency(order.calculatedNetPrice),
      vatAmount: formatCurrency(order.calculatedVat),
      grossAmount: formatCurrency(order.calculatedGrossPrice),
      campaignUrl: orderUrl,
      nextStep: "Flyer an das Empfangslager senden",
    },
    html: email.html,
  };
}
