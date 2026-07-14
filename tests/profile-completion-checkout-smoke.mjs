import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const payments = readFileSync("src/lib/payments.ts", "utf8");
const checkout = readFileSync("src/app/api/payments/checkout/route.ts", "utf8");
const completionPage = "src/app/customer/profile/complete/page.tsx";
const completionForm = "src/app/customer/profile/complete/ProfileCompletionForm.tsx";
const completionRoute = "src/app/api/customer/profile/complete/route.ts";

assert.match(payments, /missingFields/);
assert.match(payments, /CUSTOMER_PROFILE_INCOMPLETE/);
assert.match(checkout, /error\.code/);
assert.match(checkout, /422/);
assert.equal(existsSync(completionPage), true);
assert.equal(existsSync(completionForm), true);
assert.equal(existsSync(completionRoute), true);
assert.match(readFileSync(completionRoute, "utf8"), /requireTenantSession/);
assert.match(readFileSync(completionRoute, "utf8"), /createCheckoutForOrder/);
console.log("Profile completion checkout contract passed.");
