import { Prisma } from "@prisma/client";
import { buildPlanningInputFingerprint } from "@/lib/planningQuote";
import { calculateOrderPrice } from "@/lib/pricing";
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
  pricingMatchesSnapshot: boolean;
  flyerQuantityConsistent: boolean;
  paymentMatchesOrder: boolean;
  invoiceMatchesPayment: boolean;
  shipmentMatchesFlyerSource: boolean;
  polygonReferenceMatches: boolean;
  warehouseBasedOnCurrentArea: boolean;
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
      distributionSegments: { select: { flyerQuantity: true, assignedWarehouseId: true } },
    },
  });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");

  const snapshot = nestedSnapshot(order.priceRuleSnapshot);
  const currentPrice = await calculateOrderPrice({
    serviceType: order.serviceType,
    flyerQuantity: order.flyerQuantity,
    weightClass: order.weightClass,
    weightInGrams: order.weightInGrams,
    areaDifficulty: order.areaDifficulty,
  });
  const quoteInput = record(snapshot.quote.input);
  const quoteFingerprint = typeof snapshot.quote.fingerprint === "string" ? snapshot.quote.fingerprint : "";
  const targetAddress = record(order.targetAddress);
  const targetAddressStreet = typeof targetAddress.street === "string" ? targetAddress.street : null;
  const quotedStreet = typeof quoteInput.street === "string" ? quoteInput.street : null;
  const normalizedStreet = quotedStreet === "" && targetAddressStreet === order.targetAreaName
    ? ""
    : targetAddressStreet;
  const currentFingerprint = buildPlanningInputFingerprint({
    serviceType: order.serviceType,
    flyerQuantity: order.flyerQuantity,
    city: order.city,
    postalCode: order.postalCode,
    street: normalizedStreet,
    houseNumber: typeof targetAddress.houseNumber === "string" ? targetAddress.houseNumber as string : null,
    flyerSource: order.customerOwnFlyers ? "CUSTOMER_OWN" : "PRINT_SERVICE",
    productFormat: typeof snapshot.root.productFormat === "string" ? snapshot.root.productFormat : null,
    weightClass: order.weightClass,
    weightInGrams: order.weightInGrams,
    areaDifficulty: order.areaDifficulty,
    pricingRuleSignature: currentPrice.snapshot.pricingRuleSignature,
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
  const pricingMatchesSnapshot = priceMatches;
  const segmentFlyerTotal = order.distributionSegments.reduce((sum, segment) => sum + (segment.flyerQuantity ?? 0), 0);
  const flyerQuantityConsistent = Boolean(quoteInput.flyerQuantity)
    && Number(quoteInput.flyerQuantity) === order.flyerQuantity
    && (segmentFlyerTotal === 0 || segmentFlyerTotal <= order.flyerQuantity);
  const warehouseBasedOnCurrentArea = Boolean(order.assignedWarehouseId) || Boolean(snapshot.area.needsManualReview);
  const quoteMatchesOrder = Boolean(quoteFingerprint) && quoteFingerprint === currentFingerprint.fingerprint
    && Number(snapshot.quote.flyerQuantity) === order.flyerQuantity
    && pricingMatchesSnapshot
    && flyerQuantityConsistent
    && Number(snapshot.quote.coverageAreaSqm ?? order.coverageAreaSqm ?? 0) === Number(order.coverageAreaSqm ?? 0);
  const paidPayment = order.payments[0] ?? null;
  const paymentMatchesOrder = paidPayment ? decimalEqual(paidPayment.amount, order.calculatedGrossPrice) : order.status !== "PAID_WAITING_FOR_ADMIN_REVIEW";
  const invoiceMatchesPayment = !paidPayment || Boolean(order.invoice && decimalEqual(order.invoice.totalGross, paidPayment.amount));
  const shipmentRequired = order.customerOwnFlyers;
  const shipmentMatchesFlyerSource = !shipmentRequired || order.logisticsShipments.length > 0;
  const polygonReferenceMatches = Boolean(snapshot.quote.polygonHash)
    && snapshot.quote.polygonHash === currentFingerprint.polygonHash;
  const warnings: string[] = [];
  if (!pricingMatchesSnapshot) warnings.push("Pricing-Snapshot und Auftrag stimmen nicht überein.");
  if (!flyerQuantityConsistent) warnings.push("Flyermenge im Quote, Auftrag und Teilgebieten ist nicht konsistent.");
  if (!warehouseBasedOnCurrentArea) warnings.push("Kein aktuelles Lager oder dokumentierte manuelle Prüfung hinterlegt.");
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
    pricingMatchesSnapshot,
    flyerQuantityConsistent,
    paymentMatchesOrder,
    invoiceMatchesPayment,
    shipmentMatchesFlyerSource,
    polygonReferenceMatches,
    warehouseBasedOnCurrentArea,
    warnings,
    checkedAt: new Date().toISOString(),
  };
}
