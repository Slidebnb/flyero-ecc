import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function read(path) {
  assert.ok(existsSync(path), `${path} fehlt.`);
  return readFileSync(path, "utf8");
}

const page = read("src/app/verteilung-planen/page.tsx");
const home = read("src/app/page.tsx");
const wizard = read("src/app/customer/orders/new/SmartOrderWizard.tsx");
const publicQuote = read("src/app/api/public/planner/quote/route.ts");
const publicAutocomplete = read("src/app/api/public/planner/autocomplete/route.ts");
const publicGeocode = read("src/app/api/public/planner/geocode/route.ts");
const protection = read("src/lib/publicAbuseProtection.ts");
const smartMaps = read("src/lib/smartMaps.ts");

assert.match(page, /SmartOrderWizard/);
assert.match(page, /mode=["']public_quote["']/);
assert.match(home, /action="\/verteilung-planen"/);
assert.match(home, /name="query"/);
assert.match(wizard, /mode\?: "public_quote" \| "authenticated_order"/);
assert.match(wizard, /isPublicPlanner \? "" : "Koblenz, Deutschland"/);
assert.match(wizard, /PUBLIC_PLANNER_STARTED/);
assert.match(wizard, /flyero:order-planner:draft:v2/);
assert.match(wizard, /flyero:order-planner:public-draft:v2/);
assert.match(wizard, /contactPerson.*contactPhone.*notes/);
assert.match(wizard, /public_quote/);
assert.match(publicQuote, /getOrderIntelligence/);
assert.match(publicQuote, /warehouse/);
assert.match(publicQuote, /combinations/);
assert.match(publicQuote, /public-planner/);
assert.match(publicAutocomplete, /getPlaceAutocomplete/);
assert.match(publicAutocomplete, /public-planner/);
assert.match(publicGeocode, /geocodeSmartAddress/);
assert.match(publicGeocode, /public-planner/);
assert.match(protection, /"public-planner"/);
assert.match(smartMaps, /publicOnly\?: boolean/);
assert.match(smartMaps, /results\.find/);
assert.match(publicQuote, /publicOnly: true/);
assert.match(smartMaps, /\{ tenantId: null \}/);
assert.match(publicAutocomplete, /publicOnly: true/);
assert.match(publicGeocode, /publicOnly: true/);
assert.match(publicAutocomplete, /z\.string/);
assert.match(publicGeocode, /z\.object/);
assert.match(publicGeocode, /query: query\.data\.q/);
assert.match(read("src/app/api/public/planner/experience/route.ts"), /z\.object/);
assert.doesNotMatch(wizard, /mapDistrict/);
assert.doesNotMatch(wizard, /orderPolygonSvg/);
assert.doesNotMatch(wizard, />Heatmap</);
assert.match(wizard, /listenerTarget\.addListener/);
assert.match(wizard, /if \(!overlay\) return/);

for (const route of [publicQuote, publicAutocomplete, publicGeocode]) {
  assert.match(route, /publicRateLimitResponse/);
}

assert.doesNotMatch(publicQuote, /return Response\.json\(\{ ok: true, data \}/);
assert.match(publicQuote, /metrics/);
console.log("Public order planner contract checks passed.");
