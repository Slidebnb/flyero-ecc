import assert from "node:assert/strict";
import fs from "node:fs";

const smartMaps = fs.readFileSync("src/lib/smartMaps.ts", "utf8");
const orderRoute = fs.readFileSync("src/app/api/customer/orders/route.ts", "utf8");
const wizard = fs.readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const pricing = fs.readFileSync("src/lib/pricing.ts", "utf8");

assert.match(smartMaps, /serviceType\?:/);
assert.match(smartMaps, /calculateOrderPrice\(\{ serviceType: input\.serviceType/);
assert.match(orderRoute, /serviceType: data\.serviceType/);
assert.match(wizard, /value=\{serviceType\}/);
assert.match(pricing, /pricingBasisServiceType/);
console.log("service-type-pricing-smoke: ok");
