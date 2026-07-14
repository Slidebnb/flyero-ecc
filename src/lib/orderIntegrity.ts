import { Prisma } from "@prisma/client";
import { buildPlanningInputFingerprint } from "@/lib/planningQuote";
import { prisma } from "@/lib/prisma";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function nestedSnapshot(snapshot: unknown) {
  const root = record(snapshot);
  return { root, area: record(root.areaCalculationSnapshot), quote: record(record(root.areaCalculationSnapshot).quote ?? root.quote) };
}

function decimalEqual(left: unknown, right: unknown) {
  try {
    return new Prisma.Decimal(String(left ?? "0")).equals(new Prisma.Decimal(String(right ?? "0")));
  } catch {
    return false;
  }
}

export type OrderIntegrityCheck = {
  orderId: string;
  quoteMatchesOrder: boolean;
  paymentMatchesOrder: boolean;
  invoiceMatchesPayment: boolean;
  shipmentMatchesFlyerSource: boolean;
  polygonReferenceMatches: boolean;
  warnings: string[];
  checkedAt: string;
};

export async function getOrderIntegrityCheck(orderId: string): Promise<OrderIntegrityCheck> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: { where: { status: "PAID" }, orderBy: { createdAt: "desc" } },
      invoice: true,
      logisticsShipments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");

  const snapshot = nestedSnapshot(order.priceRuleSnapshot);
  const quoteInput = record(snapshot.quote.input);
  const quoteFingerprint = typeof snapshot.quote.fingerprint === "string" ? snapshot.quote.fingerprint : "";
  const currentFingerprint = buildPlanningInputFingerprint({
    flyerQuantity: order.flyerQuantity,
    city: order.city,
    postalCode: order.postalCode,
    street: typeof record(order.targetAddress).street === "string" ? record(order.targetAddress).street as string : null,
    houseNumber: typeof record(order.targetAddress).houseNumber === "string" ? record(order.targetAddress).houseNumber as string : null,
    flyerSource: order.customerOwnFlyers ? "CUSTOMER_OWN" : "PRINT_SERVICE",
    printDataStatus: snapshot.root.printDataStatus === "UPLOADED" || snapshot.root.printDataStatus === "PRINT_REQUESTED" ? snapshot.root.printDataStatus : "UPLOAD_LATER",
    preferredStartDate: order.preferredStartDate,
    preferredEndDate: order.preferredEndDate,
    coverageAreaSqm: order.coverageAreaSqm ? Number(order.coverageAreaSqm) : null,
    targetAreaGeoJson: order.targetAreaGeoJson,
  });
  const manualOverride = order.manualPriceOverride !== null;
  const manualSnapshot = snapshot.root;
  const priceMatches = manualOverride
    ? decimalEqual(manualSnapshot.manualCalculatedGross, order.calculatedGrossPrice)
    : decimalEqual(snapshot.quote.netPrice, order.calculatedNetPrice)
      && decimalEqual(snapshot.quote.vatAmount, order.calculatedVat)
      && decimalEqual(snapshot.quote.grossPrice, order.calculatedGrossPrice);
  const quoteMatchesOrder = Boolean(quoteFingerprint) && quoteFingerprint === currentFingerprint.fingerprint
    && Number(snapshot.quote.flyerQuantity) === order.flyerQuantity
    && priceMatches
    && Number(snapshot.quote.coverageAreaSqm ?? order.coverageAreaSqm ?? 0) === Number(order.coverageAreaSqm ?? 0);
  const paidPayment = order.payments[0] ?? null;
  const paymentMatchesOrder = paidPayment ? decimalEqual(paidPayment.amount, order.calculatedGrossPrice) : order.status !== "PAID_WAITING_FOR_ADMIN_REVIEW";
  const invoiceMatchesPayment = !paidPayment || Boolean(order.invoice && decimalEqual(order.invoice.totalGross, paidPayment.amount));
  const shipmentRequired = order.customerOwnFlyers;
  const shipmentMatchesFlyerSource = !shipmentRequired || order.logisticsShipments.length > 0;
  const polygonReferenceMatches = Boolean(snapshot.quote.polygonHash)
    && snapshot.quote.polygonHash === currentFingerprint.polygonHash;
  const warnings: string[] = [];
  if (!quoteMatchesOrder) warnings.push("Quote und gespeicherter Auftrag stimmen nicht vollständig überein.");
  if (manualOverride) warnings.push("Der Preis wurde durch eine dokumentierte manuelle Admin-Anpassung ersetzt.");
  if (!paymentMatchesOrder) warnings.push("Zahlungsbetrag und Auftragsbetrag stimmen nicht überein.");
  if (!invoiceMatchesPayment) warnings.push("Rechnungsbetrag und Zahlungsbetrag stimmen nicht überein.");
  if (!shipmentMatchesFlyerSource) warnings.push("Für eigene Flyer ist noch keine Lagerlieferung hinterlegt.");
  if (!polygonReferenceMatches) warnings.push("Das gespeicherte Verteilgebiet stimmt nicht mit dem Quote-Snapshot überein.");
  if (quoteInput && typeof quoteInput === "object" && typeof quoteInput.street !== "string") warnings.push("Die ursprüngliche Straßenreferenz fehlt im Quote-Snapshot.");

  return {
    orderId,
    quoteMatchesOrder,
    paymentMatchesOrder,
    invoiceMatchesPayment,
    shipmentMatchesFlyerSource,
    polygonReferenceMatches,
    warnings,
    checkedAt: new Date().toISOString(),
  };
}
