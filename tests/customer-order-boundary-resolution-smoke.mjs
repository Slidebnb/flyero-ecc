import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const wizardPath = "src/app/customer/orders/new/SmartOrderWizard.tsx";
const routePath = "src/app/api/maps/boundary-area/route.ts";
const wizard = readFileSync(wizardPath, "utf8");

assert.ok(existsSync(routePath), "Google-Grenzen brauchen eine serverseitige FLYERO-Flächenauflösung.");
const route = readFileSync(routePath, "utf8");

assert.match(route, /findOfficialBoundaries/, "Die Auflösung muss die zentrale FLYERO-Geo-Engine verwenden.");
assert.match(readFileSync("src/lib/spatialAreas.ts", "utf8"), /dataSourceType.*OFFICIAL.*IMPORTED.*LICENSED/s, "Die Engine darf nur echte importierte/amtliche Flächen verwenden.");
assert.match(readFileSync("src/lib/spatialAreas.ts", "utf8"), /ST_AsGeoJSON/, "Die Engine muss eine gespeicherte echte Geometrie zurückgeben.");
assert.match(route, /placeId/, "Die Route muss die Google placeId als Suchkontext validieren.");
assert.match(wizard, /\/api\/maps\/boundary-area/, "Der Wizard muss unbekannte Google-Grenzen serverseitig auflösen.");
assert.match(wizard, /applySavedArea\(resolvedBoundaryArea/, "Eine aufgelöste Grenze muss als echtes Teilgebiet übernommen werden.");
assert.doesNotMatch(
  wizard,
  /setSelectedAreaId\(""\);\s*setMapNotice\("Gebiet erkannt\. FLYERO bereitet die Fläche und Preisvorschau vor\."\);/,
  "Eine erkannte Google-Grenze darf nicht ohne Flächen-Commit im offenen Zustand verbleiben.",
);

console.log("Customer boundary resolution regression smoke test passed.");
