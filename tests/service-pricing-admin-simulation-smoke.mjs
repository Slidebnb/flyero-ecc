import { existsSync, readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const routePath = "src/app/api/admin/settings/pricing/simulate/route.ts";
assert(existsSync(routePath), "Admin-Pricing-Simulationsroute fehlt.");
const route = readFileSync(routePath, "utf8");

for (const required of [
  "requirePermission(Permission.PRICING_MANAGE)",
  "calculateOrderPrice",
  "validatePricingRuleChanges",
  "manualReviewRequired",
  "checkoutAllowed",
  "serviceType",
  "weightInGrams",
  "areaDifficulty",
]) {
  assert(route.includes(required), `Simulationsroute enthaelt nicht: ${required}`);
}

const page = readFileSync("src/app/admin/settings/pricing/page.tsx", "utf8");
assert(page.includes("PricingSimulationForm"), "Admin-Preisoberflaeche bindet die Vorschau nicht ein.");
const simulationForm = readFileSync("src/app/admin/settings/pricing/PricingSimulationForm.tsx", "utf8");
for (const required of ["simulate", "Preisvorschau", "Grenzprüfung"]) {
  assert(simulationForm.includes(required), `Admin-Preisoberflaeche enthaelt nicht: ${required}`);
}

console.log("service-pricing-admin-simulation-smoke: ok");
