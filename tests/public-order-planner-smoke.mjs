import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function read(path) {
  assert.ok(existsSync(path), `${path} fehlt.`);
  return readFileSync(path, "utf8");
}

const page = read("src/app/verteilung-planen/page.tsx");
const home = read("src/app/page.tsx");
const homePlannerSearch = read("src/app/PublicPlannerSearch.tsx");
const wizard = read("src/app/customer/orders/new/SmartOrderWizard.tsx");
const locationContext = read("src/lib/publicLocationContext.ts");
const validators = read("src/lib/validators.ts");
const publicQuote = read("src/app/api/public/planner/quote/route.ts");
const publicAutocomplete = read("src/app/api/public/planner/autocomplete/route.ts");
const publicGeocode = read("src/app/api/public/planner/geocode/route.ts");
const prices = read("src/app/preise/page.tsx");
const protection = read("src/lib/publicAbuseProtection.ts");
const smartMaps = read("src/lib/smartMaps.ts");

assert.match(page, /SmartOrderWizard/);
assert.match(page, /mode=["']public_quote["']/);
assert.match(home, /PublicPlannerSearch/);
assert.match(homePlannerSearch, /action="\/verteilung-planen"/);
assert.match(homePlannerSearch, /name="query"/);
assert.match(homePlannerSearch, /publicLocationSearchParams/);
assert.match(homePlannerSearch, /postalCode: selectedForQuery/);
assert.match(homePlannerSearch, /source: selectedForQuery/);
assert.match(prices, /title="Unverbindlich anfragen"/);
assert.match(prices, /href="\/verteilung-anfragen"/);
assert.match(prices, /buttonLabel="Anfrage starten"/);
assert.match(wizard, /mode\?: "public_quote" \| "authenticated_order"/);
assert.match(wizard, /const \[query, setQuery\] = useState\(""\)/);
assert.doesNotMatch(wizard, /Koblenz|Neuwied|Bendorf|56068/);
assert.match(wizard, /PUBLIC_PLANNER_STARTED/);
assert.match(wizard, /flyero:order-planner:draft:v2/);
assert.match(wizard, /flyero:order-planner:public-draft:v3/);
assert.match(wizard, /PUBLIC_STALE_DRAFT_DISCARDED/);
assert.match(wizard, /locationRequestSequenceRef/);
assert.match(wizard, /locationAbortRef/);
assert.match(wizard, /forceReplace: isPublicPlanner/);
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
assert.match(publicGeocode, /PUBLIC_GEOCODE_POSTAL_MISMATCH/);
const publicExperience = read("src/app/api/public/planner/experience/route.ts");
for (const eventType of [
  "PUBLIC_SEARCH_SUBMITTED",
  "PUBLIC_AUTOCOMPLETE_SELECTED",
  "PUBLIC_INITIAL_GEOCODE_STARTED",
  "PUBLIC_INITIAL_GEOCODE_RESOLVED",
  "PUBLIC_GEOCODE_POSTAL_MISMATCH",
  "PUBLIC_STALE_DRAFT_DISCARDED",
  "PUBLIC_LOCATION_REPLACED",
]) {
  assert.match(wizard + homePlannerSearch + publicExperience, new RegExp(eventType), `${eventType} fehlt.`);
}
assert.match(locationContext, /isGermanPostalCode/);
assert.match(locationContext, /publicLocationSearchParams/);
assert.match(read("src/app/api/public/planner/experience/route.ts"), /z\.object/);
assert.doesNotMatch(wizard, /mapDistrict/);
assert.doesNotMatch(wizard, /orderPolygonSvg/);
assert.doesNotMatch(wizard, />Heatmap</);
assert.match(wizard, /listenerTarget\.addListener/);
assert.match(wizard, /if \(!overlay\) return/);
assert.match(wizard, /minimumStartDate/);
assert.match(wizard, /addDaysToIsoDate/);
assert.match(wizard, /min=\{minimumStartDate\}/);
assert.doesNotMatch(wizard, /areaQuickList/);
assert.match(wizard, /Eigenes Gebiet zeichnen/);
assert.match(wizard, /Empfangslager f\u00fcr deine Flyer/);
assert.doesNotMatch(wizard, /Druck über FLYERO/);
assert.match(validators, /earliestOrderStartDate/);
assert.match(validators, /sieben Tage nach heute/);

for (const route of [publicQuote, publicAutocomplete, publicGeocode]) {
  assert.match(route, /publicRateLimitResponse/);
}

assert.doesNotMatch(publicQuote, /return Response\.json\(\{ ok: true, data \}/);
assert.match(publicQuote, /metrics/);
console.log("Public order planner contract checks passed.");
