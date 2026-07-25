import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pricing = readFileSync("src/lib/pricing.ts", "utf8");
const smartMaps = readFileSync("src/lib/smartMaps.ts", "utf8");
const createOrder = readFileSync("src/app/api/customer/orders/route.ts", "utf8");
const updateOrder = readFileSync("src/app/api/customer/orders/[id]/route.ts", "utf8");
const integrity = readFileSync("src/lib/orderIntegrity.ts", "utf8");
const payments = readFileSync("src/lib/payments.ts", "utf8");
const materialStep = readFileSync("src/app/customer/orders/new/OrderMaterialStep.tsx", "utf8");
const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");

assert.match(pricing, /export function deriveOrderPricingOptions\(/, "Preisoptionen muessen zentral aus Zeitraum und Segmentanzahl abgeleitet werden.");
for (const source of [smartMaps, createOrder, updateOrder, integrity, payments]) {
  assert.match(source, /deriveOrderPricingOptions\(/, "Jeder Preis-/Checkout-Pfad muss dieselbe serverseitige Preisoptionen-Ableitung verwenden.");
}
assert.match(createOrder, /additionalAreaCount:/, "Auftragserstellung muss die Anzahl der Teilgebiete an die Preislogik geben.");
assert.match(createOrder, /preferredStartDate:/, "Auftragserstellung muss den gewaehlten Zeitraum an die Preislogik geben.");
assert.doesNotMatch(materialStep, /Ungef.*Einzelgewicht|Empfangslager.*deine Flyer/, "Der Kundenwizard darf keine technischen Gewichts- oder Lagerfelder verlangen.");
assert.doesNotMatch(wizard, /Bitte w.*zuerst das Empfangslager/, "Der Abschluss darf nicht an einer manuellen Lagerauswahl blockieren.");
assert.doesNotMatch(wizard, /selectedWarehouseId|setSelectedWarehouseId/, "Der Kundenwizard darf kein veraltetes manuelles Lager im Entwurf weiterfuehren.");
const distributionStep = wizard.match(/if \(stepId === 3\) \{([\s\S]*?)\n    \}\n\n    if \(stepId === 4\)/)?.[1] ?? "";
assert.doesNotMatch(distributionStep, /<select|<textarea|<input/, "Der Kundenwizard darf im Verteilungsabschnitt keine zusaetzlichen technischen Eingaben verlangen.");

console.log("Customer order launch-scope smoke passed.");
