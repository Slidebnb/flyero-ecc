import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const orderRoute = readFileSync("src/app/api/customer/orders/route.ts", "utf8");
const payments = readFileSync("src/lib/payments.ts", "utf8");
const request = readFileSync("src/lib/request.ts", "utf8");
const reviewWorkflow = readFileSync("src/lib/orderReviewWorkflow.ts", "utf8");

assert.match(orderRoute, /if \(data\.flyerSource === "PRINT_SERVICE"\)/, "Online-Aufträge dürfen den Druckservice nicht mehr verwenden.");
assert.match(orderRoute, /code: "PRINT_SERVICE_CONTACT_ONLY"/, "Druckservice-Blockade liefert keinen fachlichen Fehlercode.");
assert.match(payments, /if \(order\.needsPrintService\)/, "Checkout prueft den Druckservice nicht serverseitig.");
assert.match(payments, /code = "PRINT_SERVICE_CONTACT_ONLY"/, "Legacy-Checkout-Blockade fuer Druckauftraege fehlt.");
assert.match(request, /code: "PRINT_SERVICE_CONTACT_ONLY"/, "Legacy-Druckservice-Fehler wird nicht kundenfreundlich gemappt.");
assert.match(reviewWorkflow, /if \(!order\.needsPrintService\)/, "Adminannahme versucht beim Druckservice weiterhin ungeprueften Checkout zu erzeugen.");
assert.match(reviewWorkflow, /Druck separat mit dir/, "Kundenkommunikation fuer separat besprochenen Druck fehlt.");

console.log("Print service payment gate smoke checks passed.");
