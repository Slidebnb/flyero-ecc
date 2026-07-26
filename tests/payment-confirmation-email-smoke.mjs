import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { buildPaymentConfirmationEmail } = await import("../src/lib/paymentConfirmation.ts");
const paymentsSource = await readFile("src/lib/payments.ts", "utf8");
const notificationsSource = await readFile("src/lib/notifications.ts", "utf8");

const result = buildPaymentConfirmationEmail({
  customerName: "Huwa Gebäudedienste",
  order: {
    id: "order-confirmation-1",
    orderNumber: "FLY-2026-0001",
    targetAreaName: "56112 Lahnstein",
    city: "Lahnstein",
    postalCode: "56112",
    flyerQuantity: 5000,
    estimatedHouseholds: 4200,
    coverageAreaSqm: "1234567.89",
    preferredStartDate: new Date("2026-08-03T00:00:00.000Z"),
    preferredEndDate: new Date("2026-08-07T00:00:00.000Z"),
    calculatedNetPrice: "1900.00",
    calculatedVat: "361.00",
    calculatedGrossPrice: "2261.00",
    assignedWarehouse: {
      name: "FLYERO Empfangslager Neuwied",
      address: { street: "Mittelweg", houseNumber: "24", postalCode: "56566", city: "Neuwied", country: "Deutschland" },
      city: "Neuwied",
      postalCode: "56566",
      country: "DE",
      openingHours: "Mo–Fr 08:00–16:00 Uhr",
      contactPerson: "FLYERO Lagerteam",
      contactPhone: "02601 9131820",
      contactEmail: "hallo@flyero.org",
    },
    distributionSegments: [
      { name: "Lahnstein", city: "Lahnstein", postalCode: "56112", areaSqm: "500000.00", flyerQuantity: 2500 },
      { name: "Koblenz-Süd", city: "Koblenz", postalCode: "56073", areaSqm: "734567.89", flyerQuantity: 2500 },
    ],
  },
  appUrl: "https://flyero.org",
});

assert.equal(result.subject, "Zahlung erhalten – deine FLYERO-Verteilung ist bestätigt");
assert.match(result.body, /FLY-2026-0001/);
assert.match(result.body, /5\.000 Flyer/);
assert.match(result.body, /Lahnstein/);
assert.match(result.body, /Koblenz-Süd/);
assert.match(result.body, /FLYERO Empfangslager Neuwied/);
assert.match(result.body, /Mittelweg 24/);
assert.match(result.body, /56566 Neuwied/);
assert.match(result.body, /Bitte gib die Auftragsnummer FLY-2026-0001 als Versandreferenz an/);
assert.match(result.body, /https:\/\/flyero\.org\/customer\/orders\//);
assert.equal(result.data.warehouseName, "FLYERO Empfangslager Neuwied");
assert.equal(result.data.flyerQuantity, 5000);
assert.match(paymentsSource, /assignedWarehouse:/);
assert.match(paymentsSource, /distributionSegments:/);
assert.match(paymentsSource, /buildPaymentConfirmationEmail/);
assert.match(paymentsSource, /skipTemplate:\s*true/);
assert.match(paymentsSource, /forceEmail:\s*true/);
assert.match(paymentsSource, /if \(!wasAlreadyPaid\)/);
assert.match(notificationsSource, /skipTemplate\?: boolean/);
assert.match(notificationsSource, /input\.skipTemplate\s*\n\s*\? null/);

console.log("Payment confirmation email smoke checks passed.");
