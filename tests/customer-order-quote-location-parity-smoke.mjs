import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const orderRoute = readFileSync("src/app/api/customer/orders/route.ts", "utf8");
const smartMaps = readFileSync("src/lib/smartMaps.ts", "utf8");
const areaSubmission = readFileSync("src/app/customer/orders/new/areaSubmission.ts", "utf8");

assert.match(
  orderRoute,
  /const orderCity = data\.city\?\.trim\(\) \|\| primarySegment\?\.city\?\.trim\(\) \|\| "";/,
  "Der Ort aus der bestaetigten Auftragseingabe muss vor Segment-Metadaten verwendet werden.",
);
assert.match(
  orderRoute,
  /const orderPostalCode = data\.postalCode\?\.trim\(\) \|\| primarySegment\?\.postalCode\?\.trim\(\) \|\| "";/,
  "Die PLZ aus der bestaetigten Auftragseingabe muss vor Segment-Metadaten verwendet werden.",
);
assert.match(
  smartMaps,
  /const effectiveCity = input\.city\?\.trim\(\) \|\| primarySegment\?\.city\?\.trim\(\) \|\| "";/,
  "Die serverseitige Gebietsberechnung muss denselben bestaetigten Ort wie die Vorschau verwenden.",
);
assert.match(
  smartMaps,
  /const effectivePostalCode = input\.postalCode\?\.trim\(\) \|\| primarySegment\?\.postalCode\?\.trim\(\) \|\| "";/,
  "Die serverseitige Gebietsberechnung muss dieselbe bestaetigte PLZ wie die Vorschau verwenden.",
);
assert.match(
  areaSubmission,
  /const city = selectedCity \|\| text\(input\.city\) \|\| segmentCity;/,
  "Die Vorschau muss den bestaetigten Ort vor Segment-Metadaten verwenden.",
);
assert.match(
  areaSubmission,
  /const postalCode = \[selectedPostalCode, inputPostalCode, segmentPostalCode\]\.find\(isGermanPostalCode\) \?\? "";/,
  "Die Vorschau muss die bestaetigte PLZ vor Segment-Metadaten verwenden.",
);

console.log("Customer order quote location parity checks passed.");
