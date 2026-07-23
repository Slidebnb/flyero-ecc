import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const wizardPath = "src/app/customer/orders/new/SmartOrderWizard.tsx";
const routePath = "src/app/api/maps/boundary-area/route.ts";
const intelligenceHookPath = "src/app/customer/orders/new/hooks/useOrderIntelligence.ts";
const wizard = readFileSync(wizardPath, "utf8");
const intelligenceHook = readFileSync(intelligenceHookPath, "utf8");

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
assert.match(
  intelligenceHook,
  /if \(!city \|\| coverageAreaSqm <= 0\)/,
  "Eine amtliche Ortsgrenze ohne einzelne PLZ muss die serverseitige Berechnung trotzdem starten.",
);
assert.doesNotMatch(
  intelligenceHook,
  /if \(!city \|\| !postalCode \|\| coverageAreaSqm <= 0\)/,
  "Die Berechnung darf nicht an einer fehlenden PLZ der Gemeindegrenze hängen.",
);
assert.match(
  intelligenceHook,
  /const \[isPending, setIsPending\] = useState\(false\)/,
  "Der Berechnungsstatus muss an den echten Netzwerkrequest gebunden sein.",
);
assert.doesNotMatch(
  intelligenceHook,
  /useTransition|startTransition/,
  "Die Live-Berechnung darf nicht über einen UI-Transitionstatus stecken bleiben.",
);
assert.match(
  intelligenceHook,
  /setIsPending\(false\);\s*if \(payload\?\.data\)/,
  "Ein erfolgreicher Berechnungslauf muss den sichtbaren Ladezustand beenden.",
);

console.log("Customer boundary resolution regression smoke test passed.");
