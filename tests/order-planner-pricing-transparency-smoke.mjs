import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/public/planner/quote/route.ts", "utf8");
const smartMaps = readFileSync("src/lib/smartMaps.ts", "utf8");
const pricing = readFileSync("src/lib/pricing.ts", "utf8");

for (const field of ["net", "vat", "gross", "netAmount", "vatAmount", "grossAmount", "vatRate", "pricingVersion", "calculatedAt", "confidence"]) {
  assert.match(route, new RegExp(field));
}
assert.match(route, /includeOperationalData: false/);
assert.match(route, /publicOnly: true/);
assert.match(route, /export async function POST/);
assert.match(route, /lineItems/);
assert.match(route, /requires_review/);
assert.match(route, /z\.object/);
assert.match(smartMaps, /calculateOrderPrice/);
assert.match(smartMaps, /vatAmount/);
assert.match(pricing, /minimumNetPrice/);
assert.match(route, /safeMetrics/);
assert.doesNotMatch(route, /metrics: safeData\.metrics/);
assert.doesNotMatch(route, /checkout/);
assert.doesNotMatch(route, /customer\/orders/);
console.log("Order planner pricing transparency checks passed.");
