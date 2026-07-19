import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const orderRoute = readFileSync("src/app/api/customer/orders/route.ts", "utf8");

assert.match(wizard, /serviceType === "PRODUCT_SAMPLING"/);
assert.match(wizard, /serviceType !== "PRODUCT_SAMPLING"/);
assert.match(wizard, /Individuelles Sampling-Angebot anfragen/);
assert.match(wizard, /samplingDetails: serviceType === "PRODUCT_SAMPLING"/);
assert.match(wizard, /quoteFingerprint: intelligence\?\.metrics\.fingerprint/);
assert.match(wizard, /pricingRuleSignature: intelligence\?\.metrics\.pricingRuleSignature/);
assert.match(wizard, /intelligenceStatus/);
assert.doesNotMatch(wizard, /areaDifficulty: "NORMAL"/);
assert.match(orderRoute, /samplingRequiresManualReview = data\.serviceType === "PRODUCT_SAMPLING"/);
assert.match(orderRoute, /SAMPLING_MANUAL_REVIEW/);
assert.match(orderRoute, /serverAreaDifficulty/);
assert.match(orderRoute, /buildServerAreaCalculationSnapshot/);
console.log("Customer order new-flow integrity checks passed.");
