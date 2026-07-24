import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canCompleteAreaSelection, resolveAreaSubmissionContext } from "../src/app/customer/orders/new/areaSubmission.ts";

const polygon = [
  { lat: 50.35, lng: 7.58 },
  { lat: 50.36, lng: 7.58 },
  { lat: 50.36, lng: 7.59 },
];

const resolved = resolveAreaSubmissionContext({
  segments: [{ name: "Bendorf", city: "", postalCode: "", points: polygon }],
  city: "",
  postalCode: "",
  selectedLocation: { city: "Bendorf", postalCode: "56170" },
  targetAreaName: "",
});

assert.equal(resolved.hasValidArea, true, "Ein ausgewähltes Polygon muss als gültiges Gebiet gelten.");
assert.equal(resolved.city, "Bendorf", "Der Ort darf durch leere Segmentwerte nicht verloren gehen.");
assert.equal(resolved.postalCode, "56170", "Die PLZ muss aus der gewählten Standortinformation erhalten bleiben.");
assert.equal(resolved.targetAreaName, "Bendorf", "Der Abschluss muss einen gültigen Gebietsname senden.");

const geometryOnlySegment = {
  name: "Bendorf",
  city: "Bendorf",
  postalCode: "56170",
  points: [],
  geometryGeoJson: {
    type: "MultiPolygon",
    coordinates: [[[
      [7.58, 50.42],
      [7.59, 50.42],
      [7.59, 50.43],
      [7.58, 50.42],
    ]]],
  },
};
const geometryOnlyResolved = resolveAreaSubmissionContext({
  segments: [geometryOnlySegment],
  city: "",
  postalCode: "",
  selectedLocation: null,
  targetAreaName: "",
});
assert.equal(geometryOnlyResolved.hasValidArea, true, "Ein importiertes GeoJSON-Gebiet muss ohne Client-Zeichenpunkte gÃ¼ltig sein.");
assert.equal(geometryOnlyResolved.city, "Bendorf");
assert.equal(geometryOnlyResolved.postalCode, "56170");

const cityBoundaryResolved = resolveAreaSubmissionContext({
  segments: [{
    name: "Neuwied",
    city: "Neuwied",
    postalCode: "",
    points: [],
    geometryGeoJson: geometryOnlySegment.geometryGeoJson,
  }],
  city: "",
  postalCode: "",
  selectedLocation: null,
  targetAreaName: "",
});
assert.equal(cityBoundaryResolved.hasValidArea, true);
assert.equal(cityBoundaryResolved.city, "Neuwied");
assert.equal(cityBoundaryResolved.postalCode, "", "Eine amtliche Stadtfläche darf keine erfundene PLZ erhalten.");
assert.equal(
  canCompleteAreaSelection({
    hasValidArea: cityBoundaryResolved.hasValidArea,
    coverageAreaSqm: 86_070_000,
    city: cityBoundaryResolved.city,
    postalCode: cityBoundaryResolved.postalCode,
  }),
  true,
  "Eine ausgewählte amtliche Stadtfläche muss auch ohne PLZ den Abschluss erlauben.",
);
assert.equal(
  canCompleteAreaSelection({
    hasValidArea: true,
    coverageAreaSqm: 86_070_000,
    city: "Neuwied",
    postalCode: "12",
  }),
  false,
  "Eine vorhandene, aber ungültige PLZ darf den Abschluss weiterhin blockieren.",
);

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
assert.match(
  wizard,
  /setMapNotice\("Gebiet[\s\S]{0,120}automatisch\."\);\s*setFinishStatus\(""\);/,
  "Eine erfolgreich Ã¼bernommene FlÃ¤che muss eine alte Abschlussfehlermeldung lÃ¶schen.",
);
assert.match(
  wizard,
  /return currentSegments\.filter\(hasAreaGeometry\);/,
  "Ein ausgewÃ¤hltes GeoJSON-Gebiet darf nicht aus dem Checkout-Payload fallen, nur weil keine Zeichenpunkte vorliegen.",
);

assert.match(
  wizard,
  /city: planningCity,\s*\n\s*postalCode: planningPostalCode,/,
  "Die Live-Berechnung muss dieselbe aufgelöste Ortsidentität wie der Abschluss verwenden.",
);

const orderRoute = readFileSync("src/app/api/customer/orders/route.ts", "utf8");
assert.match(
  orderRoute,
  /const orderCity = primarySegment\?\.city\?\.trim\(\) \|\| data\.city;/,
  "Ein leeres Segment-Stadtfeld darf die validierte Auftragsstadt nicht überschreiben.",
);
assert.match(
  orderRoute,
  /const orderPostalCode = primarySegment\?\.postalCode\?\.trim\(\) \|\| data\.postalCode;/,
  "Ein leeres Segment-PLZ-Feld darf die validierte Auftrags-PLZ nicht überschreiben.",
);

const quoteRoute = readFileSync("src/app/api/public/planner/quote/route.ts", "utf8");
assert.match(
  quoteRoute,
  /const hasSelectedArea = Boolean\(value\.targetAreaGeoJson\) \|\| \(value\.segments\?\.length \?\? 0\) > 0;/,
  "Der öffentliche Planer muss ausgewählte Stadtflächen auch ohne erfundene PLZ quotieren können.",
);

const validators = readFileSync("src/lib/validators.ts", "utf8");
assert.match(
  validators,
  /const orderPostalCode = z[\s\S]*?\.refine\(\(value\) => value === "" \|\| \/\^\\d\{5\}\$\/.test\(value\)/,
  "Die Auftragsvalidierung muss eine leere PLZ fuer eine amtliche Stadtflaeche erlauben.",
);
assert.match(
  validators,
  /postalCode: orderPostalCode,/,
  "Die Order-Validierung muss die gemeinsame PLZ-Regel verwenden.",
);

console.log("Customer selected-area completion regression checks passed.");
