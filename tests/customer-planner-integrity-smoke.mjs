import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const intelligenceHook = readFileSync("src/app/customer/orders/new/hooks/useOrderIntelligence.ts", "utf8");
const areaStep = readFileSync("src/app/customer/orders/new/OrderAreaStep.tsx", "utf8");
const smartMaps = readFileSync("src/lib/smartMaps.ts", "utf8");
const spatialAreas = readFileSync("src/lib/spatialAreas.ts", "utf8");
const publicQuote = readFileSync("src/app/api/public/planner/quote/route.ts", "utf8");
const intelligenceRoute = readFileSync("src/app/api/maps/order-intelligence/route.ts", "utf8");

assert.match(wizard, /function clearLocationSelection\(\)[\s\S]*?polygonRef\.current\?\.setMap\(null\)/, "Eine neue Suche muss das alte Karten-Overlay entfernen.");
assert.match(wizard, /mapRef\.current\?\.setCenter\(nextCenter\)/, "Ein neues Geocode-Ergebnis muss die Karte zentrieren.");
assert.match(wizard, /const hasFreshLocationInput = Boolean\(placeId\s*\|\|\s*currentQuery\.trim\(\) !== query\.trim\(\)\)/, "Eine neue PLZ darf keinen alten Ortskontext verwenden.");
assert.match(wizard, /const localHouseholds = useMemo\(\(\) => planningAreaSqm > 0 \? estimateHouseholdsFromArea\(planningAreaSqm\) : 0/, "Ohne Fläche darf der Wizard keine Haushalte anzeigen.");
assert.doesNotMatch(wizard, /Preisvorschau folgt/, "Der veraltete Dauerstatus darf nicht im Kundenwizard stehen.");
assert.doesNotMatch(wizard, /Gebiet erkannt\. FLYERO bereitet die Fläche und Preisvorschau vor\./, "Der alte unbestätigte Gebietsstatus darf nicht sichtbar sein.");
assert.match(wizard, /currentIntelligenceStatus === "live"[\s\S]*?householdRecommendationAllowed === true[\s\S]*?recommendedFlyerQuantity/, "Die Flyerempfehlung muss vom Serverergebnis kommen.");
assert.match(wizard, /maps\.event\.addListener\(mapRef\.current, ["']click["']|mapRef\.current\.addListener\(["']click["']/, "Manuelle Gebiete müssen über die Karten-Klick-API gezeichnet werden.");
assert.match(wizard, /const USE_GOOGLE_BOUNDARY_LAYERS = false/, "Google Boundaries dürfen nicht die verbindliche Auswahlquelle sein.");
assert.match(wizard, /const boundarySelectionEnabled = officialBoundaries\.length > 0/, "Nur FLYERO-eigene importierte Flächen dürfen klickbar sein.");
assert.match(wizard, /\/api\/maps\/official-boundaries\?/, "Der Wizard muss FLYERO-Flächen serverseitig laden.");
assert.match(wizard, /geometryGeoJson: area\.geoJson/, "Eine ausgewählte offizielle Fläche muss ihre Geometrie mitnehmen.");
assert.match(wizard, /segment\.geometryGeoJson \?\? polygonToGeoJson\(segment\.points\)/, "Die gespeicherte Geometrie muss vor Client-Punkten verwendet werden.");
assert.match(spatialAreas, /ST_Intersects/, "Die Geo Engine muss die PostGIS-Schnittmenge verwenden.");
assert.match(spatialAreas, /ST_AsGeoJSON/, "Die Geo Engine muss gespeicherte Geometrie als GeoJSON ausgeben.");
assert.match(smartMaps, /residentialBuildings[\s\S]*buildingCountSource/, "Gebäudedaten müssen als echte optionale Gebietsdaten mitgeführt werden.");
assert.match(smartMaps, /householdRecommendationAllowed[\s\S]*recommendedFlyerQuantity/, "Server und Kundenwizard müssen dieselbe Empfehlung verwenden.");
assert.match(intelligenceHook, /controller\.abort\(\)/, "Veraltete Berechnungen müssen abgebrochen werden.");
assert.match(intelligenceRoute, /targetAreaGeoJson: jsonParam\(params\.get\("targetAreaGeoJson"\)\)/, "Die Live-Berechnung muss die Fläche serverseitig verarbeiten.");
assert.match(publicQuote, /recommendedFlyerQuantity: safeData\.metrics\.recommendedFlyerQuantity/, "Der öffentliche Planer muss dieselbe Serverempfehlung erhalten.");
assert.match(areaStep, /Fläche auf der Karte zeichnen/, "Die nächste Aktion muss verständlich formuliert sein.");
assert.match(wizard, /const mapLocationLabel = \[postalCode, city\]/, "Der aktuelle Ortsname muss aus dem aktuellen Suchzustand kommen.");
assert.match(wizard, /const priceReady = currentIntelligenceStatus === "live"/, "Der Preisstatus muss an die aktuelle Berechnung gebunden sein.");

console.log("Customer planner integrity smoke test passed.");
