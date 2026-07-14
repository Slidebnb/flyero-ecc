import { existsSync, readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(existsSync("src/lib/planningQuote.ts"), "Zentraler Planning-Quote-Contract fehlt.");
const quoteSource = readFileSync("src/lib/planningQuote.ts", "utf8");
const orderRoute = readFileSync("src/app/api/customer/orders/route.ts", "utf8");
const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");

for (const required of ["buildPlanningInputFingerprint", "PLANNING_QUOTE_CHANGED", "calculationVersion", "pricingRuleSignature"]) {
  assert(quoteSource.includes(required) || orderRoute.includes(required), `Quote-Contract enthaelt nicht: ${required}`);
}
assert(orderRoute.includes("quoteFingerprint"), "Order-API muss den bestaetigten Quote-Fingerprint pruefen.");
assert(orderRoute.includes("409"), "Veraltete Quote muss mit HTTP 409 blockiert werden.");
assert(wizard.includes("quoteFingerprint"), "Planner muss den bestaetigten Quote-Fingerprint mitsenden.");
assert(wizard.includes("Preis wird aktualisiert"), "Planner muss stale Preis sichtbar markieren.");

console.log("Order stale quote contract checks passed.");
