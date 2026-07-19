import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const pricingPage = readFileSync("src/app/preise/page.tsx", "utf8");
const pricing = readFileSync("src/lib/pricing.ts", "utf8");
const smartMaps = readFileSync("src/lib/smartMaps.ts", "utf8");
const publicQuote = readFileSync("src/app/api/public/planner/quote/route.ts", "utf8");
const intelligenceRoute = readFileSync("src/app/api/maps/order-intelligence/route.ts", "utf8");
const deployment = readFileSync("DEPLOYMENT_HETZNER.md", "utf8");
const dockerfile = readFileSync("Dockerfile", "utf8");

function assertMatch(pattern, message) {
  assert.match(wizard, pattern, message);
}

assertMatch(
  /function clearLocationSelection\(\) \{[\s\S]*?polygonRef\.current\?\.setMap\(null\);\s*polygonRef\.current = null;/,
  "Eine neue Suche muss den alten Karten-Overlay sofort entfernen.",
);
assertMatch(
  /const nextCenter = \{ lat: Number\(result\.lat\), lng: Number\(result\.lng\) \};[\s\S]*?mapRef\.current\?\.setCenter\(nextCenter\);/,
  "Ein neues Geocode-Ergebnis muss die bestehende Google-Karte direkt zentrieren.",
);
const viewportCenterIndex = wizard.indexOf("mapRef.current.setCenter(center);");
assert.ok(viewportCenterIndex >= 0, "Die Kartenansicht muss ihr Zentrum aus dem aktuellen Standort beziehen.");
assert.ok(
  wizard.indexOf("if (polygon.length < 3", viewportCenterIndex) > viewportCenterIndex,
  "Die Karte muss auch ohne bestehendes Polygon auf eine neue PLZ zentriert werden.",
);
assertMatch(
  /const hasFreshLocationInput = Boolean\(placeId\s*\|\|\s*currentQuery\.trim\(\) !== query\.trim\(\)\);/,
  "Bei einer neuen Suche darf der alte PLZ-/Ort-Kontext nicht an die Geocode-API gehen.",
);
assertMatch(
  /const localHouseholds = useMemo\(\(\) => coverageAreaSqm > 0 \? estimateHouseholdsFromArea\(coverageAreaSqm\) : 0,/,
  "Ohne gezeichnete Flaeche darf der Wizard keine Haushalte als Grundlage anzeigen.",
);
assert.doesNotMatch(wizard, /"Preisvorschau folgt"/, "Der veraltete Dauerstatus darf nicht mehr im Kundenwizard stehen.");
assert.match(
  wizard,
  /applyLocationResult\(result, \{ forceReplace: !options\?\.initial \}\)/,
  "Eine neue Suche muss das bisherige Gebiet vor dem Rezentrieren ersetzen.",
);
assert.match(
  wizard,
  /intelligence\?\.metrics\.recommendedFlyerQuantity \?\? MINIMUM_FLYER_QUANTITY/,
  "Die Flyerempfehlung muss vom serverseitigen Gebietsergebnis kommen.",
);
assert.doesNotMatch(wizard, /libraries=drawing|maps\.drawing|DrawingManager|polygoncomplete/, "Der Planner darf nicht von der abgekündigten Google-Drawing-Bibliothek abhängen.");
assert.match(wizard, /order-finish-drawing|Klicke auf der Karte.*Eckpunkte|Eckpunkte.*Gebiet/, "Der Planner braucht einen eigenen, sichtbaren Abschluss für gezeichnete Gebiete.");
assert.match(wizard, /maps\.event\.addListener\(mapRef\.current, ["']click["']|mapRef\.current\.addListener\(["']click["']/, "Gebiete müssen über die stabile Map-Klick-API gezeichnet werden.");
assert.match(
  wizard,
  /const previewCoverageAreaSqm = drawingPoints\.length >= 3\s*\?\s*polygonAreaSqm\(drawingPoints\)\s*:\s*coverageAreaSqm;/,
  "Während des Zeichnens muss die lokale Flächenvorschau sofort sichtbar werden.",
);
assert.match(
  wizard,
  /previewCoverageAreaSqm[^\n]*toLocaleString\("de-DE"/,
  "Die Gebietsübersicht muss die aktuelle Zeichenfläche statt dauerhaft 0 km² anzeigen.",
);
assert.match(
  pricingPage,
  /calculateOrderPrice\(\{ serviceType: ServiceType\.FLYER_STANDARD,/,
  "Die oeffentliche Preisseite muss die aktuelle FLYER_STANDARD-Preisquelle verwenden.",
);
assert.match(
  pricingPage,
  /rule\.serviceType === ServiceType\.FLYER_STANDARD/,
  "Der Mindestauftrag auf der oeffentlichen Preisseite darf nicht aus der historischen Regel stammen.",
);
assert.match(
  pricing,
  /const pricingServiceType = normalizeOnlineServiceType\(input\.serviceType\) as ServiceType;/,
  "Historische ServiceType-Werte muessen vor einer neuen Preisberechnung auf die aktuelle Regelquelle normalisiert werden.",
);
assertMatch(
  /Gebiet ausw[aä]hlen/,
  "Bei fehlender Flaeche muss der Kunde eine klare naechste Aktion sehen.",
);
assert.match(
  wizard,
  /useState<"boundary" \| "draw">\("draw"\)/,
  "Der Wizard darf Kunden ohne Boundary-Konfiguration nicht in einen unbedienbaren Grenzmodus zwingen.",
);
assert.doesNotMatch(
  wizard,
  /Ort gefunden\. Klicke jetzt eine markierte Grenze an/,
  "Nach einer Ortssuche darf keine nicht verfuegbare Grenzauswahl als Pflichtschritt erscheinen.",
);
assert.doesNotMatch(
  wizard,
  /Die Grenzen kannst du danach direkt auf der Karte anpassen\./,
  "Der Kunde darf nicht auf eine nicht vorhandene Grenzinteraktion verwiesen werden.",
);
assert.match(
  wizard,
  /const priceReady = intelligenceStatus === "live"[\s\S]*?const pricePreviewText = coverageAreaSqm <= 0[\s\S]*?"Gebiet ausw[aä]hlen"/,
  "Preisstatus muss Gebiet, laufende Berechnung und manuelle Pruefung unterscheiden.",
);

assertMatch(
  /const recommendedFlyerQuantity = intelligence\?\.metrics\.recommendedFlyerQuantity \?\? MINIMUM_FLYER_QUANTITY/,
  "Ohne Flaeche darf die Empfehlung nicht kuenstlich auf 500 Flyer springen.",
);
assert.match(
  smartMaps,
  /householdRecommendationAllowed[\s\S]*recommendedFlyerQuantity/,
  "Server und Kundenwizard muessen dieselbe Mindestempfehlung verwenden.",
);
assert.match(
  publicQuote,
  /recommendedFlyerQuantity: safeData\.metrics\.recommendedFlyerQuantity/,
  "Der oeffentliche Planer muss dieselbe serverseitige Flyerempfehlung erhalten.",
);
assert.match(
  intelligenceRoute,
  /targetAreaGeoJson: jsonParam\(params\.get\("targetAreaGeoJson"\)\)/,
  "Die geschuetzte Live-Berechnung muss die gezeichnete Flaeche serverseitig verarbeiten.",
);
assertMatch(
  /setMapNotice\("Standort wird gesucht\.\.\."\);/,
  "Eine neue PLZ-Suche muss den alten Suchhinweis sofort ersetzen.",
);
const blurHandler = wizard.match(/function closeSuggestionsSoon\(\)\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "";
assert.ok(blurHandler, "Der Suchfeld-Blur-Handler muss vorhanden sein.");
assert.doesNotMatch(
  blurHandler,
  /geocodeAddress\(\)/,
  "Ein normales Verlassen des Suchfelds darf keinen Geocode-Request ausloesen.",
);
assertMatch(
  /const warehouseSuggestionLabel = coverageAreaSqm > 0[\s\S]*?"Gebiet auswählen";/,
  "Ohne Flaeche darf das Lagerfeld keine offene Pruefung suggerieren.",
);
assert.doesNotMatch(
  wizard,
  /warehouseSuggestion \?\? "wird geprüft"/,
  "Der alte offene Lagerstatus darf nicht zurueckkehren.",
);
assertMatch(
  /confidenceLabel\(areaStats\.confidence, coverageAreaSqm > 0\)/,
  "Die Datenbasis muss ohne Flaeche einen klaren naechsten Schritt anzeigen.",
);
assertMatch(
  /function deliverabilityLabel\(score\?: number \| null, hasArea = true\)[\s\S]*?if \(!hasArea\) return "Gebiet auswählen";/,
  "Ohne Flaeche darf der Verfuegbarkeitsstatus keine laufende Pruefung suggerieren.",
);
assertMatch(
  /deliverabilityLabel\(deliverabilityScore, coverageAreaSqm > 0\)/,
  "Der Verfuegbarkeitsstatus muss an die aktuelle Flaeche gebunden sein.",
);
assert.match(
  wizard,
  /const featureTypes = \[\s*"POSTAL_CODE",\s*"LOCALITY"\s*\];/,
  "Boundary-Layer muessen mit den von Google dokumentierten Feature-Typen aktiviert werden.",
);
assert.doesNotMatch(
  wizard,
  /if \(!mapsReady \|\| !mapsBoundaryConfigured \|\| !mapRef\.current \|\| !window\.google\?\.maps\?\.FeatureType\) return;/,
  "Die Auswahl darf nicht ausfallen, nur weil FeatureType nicht als Laufzeitobjekt exponiert ist.",
);
assert.match(
  wizard,
  /if \(!mapsBoundaryConfigured\)[\s\S]*?setAreaSelectionMode\("draw"\);/,
  "Ohne verfuegbare Boundary-Layer muss der Wizard direkt in den Zeichenmodus wechseln.",
);
assert.match(
  wizard,
  /boundaryLayerStatus === "available" \? \([\s\S]*?data-testid="order-select-boundary"/,
  "Eine Grenzauswahl darf nur angezeigt werden, wenn Google die Boundary-Layer wirklich bereitstellt.",
);

const migrationCommand = "docker compose -f docker-compose.production.yml run --rm app npx prisma migrate deploy";
assert.ok(deployment.includes(migrationCommand), "Das Produktions-Deployment muss Prisma-Migrationen vor dem Start ausfuehren.");
const fullStackStart = deployment.search(/docker compose -f docker-compose\.production\.yml up -d\r?\n/);
assert.ok(fullStackStart >= 0 && deployment.indexOf(migrationCommand) < fullStackStart, "Migrationen muessen vor dem Produktionsstart dokumentiert sein.");
assert.match(dockerfile, /prisma migrate deploy && npm run start/, "Der Produktionscontainer muss vor Next.js den Prisma-Schemaabgleich ausfuehren.");

console.log("Customer planner integrity smoke checks passed.");
