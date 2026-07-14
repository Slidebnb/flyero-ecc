import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const checkout = readFileSync("src/app/api/payments/checkout/route.ts", "utf8");
assert.match(wizard, /"AUTH_GATE_VIEWED"/);
assert.doesNotMatch(wizard, /eventType: completionPath === "direct_payment" \? "CHECKOUT_STARTED"/);
assert.match(checkout, /\["CHECKOUT_STARTED", "PAYMENT_REDIRECTED"\]/);
assert.match(checkout, /payment\.checkout/);
assert.match(wizard, /PUBLIC_ORDER_DRAFT_KEY/);
console.log("Activation handoff contract passed.");
