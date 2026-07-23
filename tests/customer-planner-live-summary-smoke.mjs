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
assert.match(
  wizard,
  /const localHouseholds = useMemo\(\(\) => planningAreaSqm > 0 \? estimateHouseholdsFromArea\(planningAreaSqm\) : 0,/,
  "Haushalte und lokale Routenwerte müssen sich während der aktuellen Flächenänderung aktualisieren.",
);
assert.match(
  wizard,
  /const priceReady = currentIntelligenceStatus === "live"[\s\S]*?Number\(netPrice\) > 0;/,
  "Ein serverseitig berechneter Preis darf nicht allein wegen einer manuellen Lagerprüfung verborgen werden.",
);
assert.match(
  wizard,
  /const recommendedFlyerQuantity = currentIntelligenceStatus === "live"[\s\S]*?currentIntelligence\?\.metrics\.householdRecommendationAllowed === true[\s\S]*?currentIntelligence\.metrics\.recommendedFlyerQuantity \?\? MINIMUM_FLYER_QUANTITY/,
  "Die Flyerempfehlung muss bei einer berechneten Fläche aus der aktuellen Haushaltsbasis entstehen.",
);
assert.match(
  wizard,
  /const warehouseSuggestionLabel = hasPlanningArea[\s\S]*?Gebiet auswählen/,
  "Ohne aktuelle Fläche darf die Planung kein Lager aus einem früheren oder globalen Default anzeigen.",
);
assert.match(
  wizard,
  /const recommendationLabel = !hasPlanningArea[\s\S]*?"Gebietsdaten geschätzt"/,
  "Eine nicht amtlich/lizenziert bestätigte Flyerempfehlung muss im Kundenportal verständlich gekennzeichnet werden.",
);
assert.match(materialStep, /recommendationLabel/, "Der Materials-Schritt muss die fachliche Empfehlungskennzeichnung darstellen.");
assert.match(
  smartMaps,
  /findBestWarehouseForArea\(\{ city: effectiveCity, postalCode: effectivePostalCode, allowDefault: false \}\)/,
  "Die Live-Planung darf bei fehlendem Regionsmatch nicht still auf das Default-Lager zurückfallen.",
);

assert.match(
  smartMaps,
  /findBestWarehouseForArea\(\{ city: segment\.city, postalCode: segment\.postalCode, allowDefault: false \}\)/,
  "Auch Mehrgebiets-Segmente duerfen nicht still auf das Default-Lager zurueckfallen.",
);

console.log("Customer planner live summary smoke checks passed.");
