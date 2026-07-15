import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const orderRoute = readFileSync("src/app/api/customer/orders/[id]/route.ts", "utf8");
const maps = readFileSync("src/lib/smartMaps.ts", "utf8");
const publicGeocodeRoute = readFileSync("src/app/api/public/planner/geocode/route.ts", "utf8");

assert.doesNotMatch(
  wizard,
  /useState<LatLng>\(isPublicPlanner \? PUBLIC_DEFAULT_CENTER : DEFAULT_CENTER\)/,
  "Der eingeloggte Wizard darf nicht mit einem Koblenz-Standort starten.",
);
assert.doesNotMatch(
  wizard,
  /pushPolygon\(polygonAroundCenter\(nextCenter\), "postal_code"\)/,
  "Eine Google-Geocodierung darf kein erfundenes Ersatzpolygon erzeugen.",
);
assert.doesNotMatch(wizard, /Koblenz|56068/, "Der Kundenwizard darf keine feste lokale Startregion enthalten.");
assert.match(wizard, /geocodeAddress\(suggestion\.label, suggestion\.source === "google" \? suggestion\.id : undefined, \{/);
assert.match(wizard, /postalCode: suggestion\.postalCode/);
assert.match(wizard, /locationRequestSequenceRef/);
assert.match(wizard, /PUBLIC_GEOCODE_POSTAL_MISMATCH/);
assert.match(maps, /placeId\?: string/);
assert.match(maps, /url\.searchParams\.set\("place_id", placeId\)/);
assert.match(publicGeocodeRoute, /placeId: z\.string\(\)\.trim\(\)\.max\(160\)\.optional\(\)/);
assert.match(orderRoute, /PAYMENT_PENDING/);
assert.match(orderRoute, /PAYMENT_FAILED/);
assert.match(
  orderRoute,
  /payments[\s\S]*PAID|PAID[\s\S]*payments/,
  "Der Löschschutz muss erfolgreiche Zahlungen serverseitig prüfen.",
);
assert.match(wizard, /repeatPrintChoice/);
assert.match(wizard, /Druckdaten sind unverändert/);
assert.match(wizard, /Druckdaten haben sich geändert/);

console.log("Customer distribution flow contract checks passed.");
