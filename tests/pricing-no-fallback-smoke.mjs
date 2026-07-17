import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("src/lib/pricing.ts", "utf8");
assert.doesNotMatch(source, /requestedRules\.length\s*\|\|\s*pricingServiceType\s*===\s*ServiceType\.FLYER_STANDARD/, "Fehlende Service-Regeln dürfen nicht auf FLYER_STANDARD ausweichen.");
assert.doesNotMatch(source, /return calculatePremiumDistributionTierNetPrice\(safeQuantity\)/, "Fehlende Staffelregel darf nicht auf einen alten Preis zurückfallen.");
assert.doesNotMatch(source, /rules\.length\s*\?\s*calculateConfiguredTierNetPrice/, "Leere PricingRules dürfen nicht still einen alten Basispreis verwenden.");
console.log("Pricing no-fallback smoke checks passed.");