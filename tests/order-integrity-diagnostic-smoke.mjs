import { readFileSync } from "node:fs";
function assert(condition, message) { if (!condition) throw new Error(message); }
const service = readFileSync("src/lib/orderIntegrity.ts", "utf8");
const route = readFileSync("src/app/api/admin/orders/[id]/integrity/route.ts", "utf8");
assert(service.includes("quoteMatchesOrder"), "Quote-Integritaetspruefung fehlt.");
assert(service.includes("pricingMatchesSnapshot"), "Pricing-Snapshot-Pruefung fehlt.");
assert(service.includes("flyerQuantityConsistent"), "Flyermengen-Pruefung fehlt.");
assert(service.includes("paymentMatchesOrder"), "Zahlungsabgleich fehlt.");
assert(service.includes("invoiceMatchesPayment"), "Rechnungsabgleich fehlt.");
assert(service.includes("shipmentMatchesFlyerSource"), "Fulfillment-Abgleich fehlt.");
assert(service.includes("polygonReferenceMatches"), "Polygon-Referenzabgleich fehlt.");
assert(service.includes("warehouseBasedOnCurrentArea"), "Lagerabgleich fehlt.");
assert(route.includes("Permission.ORDER_MANAGE"), "Integritaetsdiagnose muss adminbeschraenkt sein.");
console.log("Order integrity diagnostic checks passed.");
