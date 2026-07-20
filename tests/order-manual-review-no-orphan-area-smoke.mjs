import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/customer/orders/route.ts", "utf8");

const manualReviewGate = route.indexOf('if (data.completionPath === "direct_payment" && (requiresManualReview || samplingRequiresManualReview || !price.snapshot.checkoutAllowed))');
const createArea = route.indexOf("createDistributionArea({");

assert(manualReviewGate >= 0, "Der Direktbuchungs-Gate fuer manuelle Pruefung fehlt.");
assert(createArea >= 0, "Die serverseitige Gebietsspeicherung fehlt.");
assert(manualReviewGate < createArea, "Ein abgelehnter Direktcheckout darf kein verwaistes Gebiet anlegen.");

console.log("Manual-review orphan-area regression check passed.");
