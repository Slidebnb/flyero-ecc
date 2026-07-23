import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");

assert.match(
  wizard,
  /const planningPrimarySegment = areaSegmentsPayload\[0\];[\s\S]*?const planningCity = planningPrimarySegment\?\.city \|\| city;[\s\S]*?const planningPostalCode = planningPrimarySegment\?\.postalCode \|\| postalCode;/,
  "Live-Quote und Auftrag brauchen dieselbe primaere Segment-Ortsidentitaet.",
);
assert.match(
  wizard,
  /setActiveSegmentId\(segmentId\);[\s\S]*?setAreaSelectionMode\("boundary"\);[\s\S]*?pushPolygon\(matchedArea\.points, "saved_area"\);/,
  "Eine gespeicherte Google-Flaeche muss nach der Suche direkt als waehltbares Gebiet aktiv sein.",
);
assert.match(
  wizard,
  /city:\s*planningCity,[\s\S]*?postalCode:\s*planningPostalCode,/,
  "Die Live-Berechnung muss mit dem verbindlichen Segment-Ort angefragt werden.",
);
assert.match(
  wizard,
  /function buildOrderPayload\([\s\S]*?city:\s*planningCity,[\s\S]*?postalCode:\s*planningPostalCode,/,
  "Der Checkout muss exakt dieselbe Ortsidentitaet wie die Live-Berechnung senden.",
);
assert.match(
  wizard,
  /function boundaryLayerStyle\(selectedPlaceIds: string\[\], hideSelected = false, hideAll = false\)/,
  "Die Boundary-Darstellung muss eine vollstaendige Ausblendung nach dem Uebernehmen erlauben.",
);
assert.match(
  wizard,
  /if \(hideAll \|\| \(selected && hideSelected\)\)/,
  "Nach dem Uebernehmen darf keine zweite Google-Flaeche unter dem FLYERO-Polygon sichtbar bleiben.",
);
assert.match(
  wizard,
  /boundaryLayerStyle\(selectedBoundaryPlaceIdsRef\.current, false, hasActiveCommittedArea\)/,
  "Boundary-Layer muessen auch vor einer bestaetigten FLYERO-Flaeche sichtbar bleiben.",
);
assert.match(
  wizard,
  /boundaryLayerStyle\(selectedBoundaryPlaceIds, false, hasActiveCommittedArea\)/,
  "Auch spaetere Boundary-Style-Updates muessen die Auswahl sichtbar halten.",
);

console.log("Customer boundary checkout smoke checks passed.");
