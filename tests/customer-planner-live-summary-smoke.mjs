import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const smartMaps = readFileSync("src/lib/smartMaps.ts", "utf8");
const materialStep = readFileSync("src/app/customer/orders/new/OrderMaterialStep.tsx", "utf8");

assert.match(
  wizard,
  /const planningAreaSqm = previewCoverageAreaSqm;[\s\S]*?const hasPlanningArea = planningAreaSqm > 0;/,
  "Die Gebietsübersicht muss dieselbe aktuelle Fläche wie die lokale Karten-Vorschau verwenden.",
);
assert.doesNotMatch(
  wizard,
  /const localHouseholds|estimateHouseholdsFromArea|estimateWalkingDistanceMeters|estimateTeamDurationMinutes/,
  "Haushalte und lokale Routenwerte dürfen sich nicht aus einer Frontend-Formel ergeben.",
);
assert.match(
  wizard,
  /const priceReady = currentIntelligenceStatus === "live"[\s\S]*?Number\(netPrice\) > 0;/,
  "Ein serverseitig berechneter Preis darf nicht allein wegen einer manuellen Lagerprüfung verborgen werden.",
);
assert.match(
  wizard,
  /const recommendedFlyerQuantity = currentIntelligenceStatus === "live"[\s\S]*?currentIntelligence\?\.metrics\.householdRecommendationAllowed === true[\s\S]*?recommendedFlyerQuantity \?\? null/,
  "Die Flyerempfehlung muss aus belastbaren Serverdaten kommen oder leer bleiben.",
);
assert.match(
  wizard,
  /const warehouseSuggestionLabel = hasPlanningArea[\s\S]*?Gebiet auswählen/,
  "Ohne aktuelle Fläche darf die Planung kein Lager aus einem früheren oder globalen Default anzeigen.",
);
assert.match(
  wizard,
  /const recommendationLabel = !hasPlanningArea[\s\S]*?Noch keine belastbare Mengenempfehlung/,
  "Eine nicht belastbar bestätigte Flyerempfehlung muss im Kundenportal verständlich gekennzeichnet werden.",
);
assert.match(materialStep, /recommendationLabel/, "Der Materials-Schritt muss die fachliche Empfehlungskennzeichnung darstellen.");
assert.match(
  smartMaps,
  /findBestWarehouseForArea\(\{ city: effectiveCity, postalCode: effectivePostalCode, allowDefault: true \}\)/,
  "Die Live-Planung muss das festgelegte Standardlager für jedes Gebiet berücksichtigen.",
);
assert.match(
  smartMaps,
  /findBestWarehouseForArea\(\{ city: segment\.city, postalCode: segment\.postalCode, allowDefault: true \}\)/,
  "Auch Mehrgebiets-Segmente müssen das festgelegte Standardlager berücksichtigen.",
);

console.log("Customer planner live summary smoke checks passed.");
