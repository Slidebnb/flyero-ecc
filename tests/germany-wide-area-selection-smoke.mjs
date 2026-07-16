import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const planningQuote = readFileSync("src/lib/planningQuote.ts", "utf8");
const intelligence = readFileSync("src/lib/smartMaps.ts", "utf8");
const orderRoute = readFileSync("src/app/api/customer/orders/route.ts", "utf8");
const publicQuote = readFileSync("src/app/api/public/planner/quote/route.ts", "utf8");

assert.match(wizard, /selectedLocation/);
assert.match(wizard, /placeId/);
assert.match(wizard, /source/);
assert.match(wizard, /setSelectedLocation\(null\)/);
assert.match(wizard, /locationSource/);
assert.match(planningQuote, /placeId\?: string/);
assert.match(planningQuote, /locationSource/);
assert.match(planningQuote, /latitude/);
assert.match(intelligence, /placeId\?: string/);
assert.match(intelligence, /locationSource/);
assert.match(orderRoute, /placeId: data\.placeId/);
assert.match(publicQuote, /placeId/);
assert.doesNotMatch(wizard, /Koblenz|Neuwied|Bendorf/);

console.log("Germany-wide area selection smoke passed.");
