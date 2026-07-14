import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const publicExperience = readFileSync("src/app/api/public/planner/experience/route.ts", "utf8");
const authenticatedExperience = readFileSync("src/app/api/maps/experience/route.ts", "utf8");
const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const checkout = readFileSync("src/app/api/payments/checkout/route.ts", "utf8");

assert.doesNotMatch(publicExperience, /"CHECKOUT_STARTED"/);
assert.match(authenticatedExperience, /CHECKOUT_STARTED/);
assert.match(authenticatedExperience, /linkedOrder/);
assert.match(wizard, /"AUTH_GATE_VIEWED"/);
assert.match(checkout, /\["CHECKOUT_STARTED", "PAYMENT_REDIRECTED"\]/);
assert.match(checkout, /createCheckoutForOrder/);
console.log("Planner funnel event contract passed.");
