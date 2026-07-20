import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const areaStep = readFileSync("src/app/customer/orders/new/OrderAreaStep.tsx", "utf8");
const pricingPage = readFileSync("src/app/preise/page.tsx", "utf8");
const pricing = readFileSync("src/lib/pricing.ts", "utf8");
const smartMaps = readFileSync("src/lib/smartMaps.ts", "utf8");
const publicQuote = readFileSync("src/app/api/public/planner/quote/route.ts", "utf8");
const planningQuote = readFileSync("src/lib/planningQuote.ts", "utf8");
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
  /const localHouseholds = useMemo\(\(\) => planningAreaSqm > 0 \? estimateHouseholdsFromArea\(planningAreaSqm\) : 0,/,
  "Ohne aktuelle Flaeche darf der Wizard keine Haushalte als Grundlage anzeigen.",
);
assert.doesNotMatch(wizard, /"Preisvorschau folgt"/, "Der veraltete Dauerstatus darf nicht mehr im Kundenwizard stehen.");
assert.match(
  wizard,
  /applyLocationResult\(result, \{ forceReplace: !options\?\.initial \}\)/,
  "Eine neue Suche muss das bisherige Gebiet vor dem Rezentrieren ersetzen.",
);
assert.match(
  wizard,
  /intelligence\?\.metrics\.householdRecommendationAllowed === true[\s\S]*?intelligence\.metrics\.recommendedFlyerQuantity/,
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
assert.doesNotMatch(
  wizard,
  /Wenn eine markierte Fl[aÃ¤]che verf[aÃ¼]gbar ist/,
  "Nach der Ortssuche darf der Kunde nicht auf eine optionale, nicht sichtbare Grenzfläche verwiesen werden.",
);
assert.match(
  wizard,
  /areaSegmentsRef\.current = \[\];\s*setAreaSegments\(\[\]\);\s*setAreaSelectionMode\("draw"\);/,
  "Eine neue Ortssuche muss den nutzbaren Zeichenmodus sicher aktivieren.",
);
assert.match(
  wizard,
  /const priceReady = intelligenceStatus === "live"[\s\S]*?const pricePreviewText = coverageAreaSqm <= 0[\s\S]*?"Gebiet ausw[aä]hlen"/,
  "Preisstatus muss Gebiet, laufende Berechnung und manuelle Pruefung unterscheiden.",
);

assertMatch(
  /const recommendedFlyerQuantity = intelligenceStatus === "live"[\s\S]*?MINIMUM_FLYER_QUANTITY/,
  "Ohne Flaeche darf die Empfehlung nicht kuenstlich auf eine alte Menge springen.",
);
assert.match(
  smartMaps,
  /householdRecommendationAllowed[\s\S]*recommendedFlyerQuantity/,
  "Server und Kundenwizard muessen dieselbe Mindestempfehlung verwenden.",
);
assert.match(
  planningQuote,
  /productFormat:\s*normalizeServiceProductFormat\(/,
  "Public Planner und Kundenauftrag muessen das Flyerformat vor dem Fingerprint zentral normalisieren.",
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
  /const warehouseSuggestionLabel = hasPlanningArea[\s\S]*?"Gebiet auswählen";/,
  "Ohne Flaeche darf das Lagerfeld keine offene Pruefung suggerieren.",
);
assert.doesNotMatch(
  wizard,
  /warehouseSuggestion \?\? "wird geprüft"/,
  "Der alte offene Lagerstatus darf nicht zurueckkehren.",
);
assertMatch(
  /confidenceLabel\(areaStats\.confidence, hasPlanningArea\)/,
  "Die Datenbasis muss ohne Flaeche einen klaren naechsten Schritt anzeigen.",
);
assertMatch(
  /function deliverabilityLabel\(score\?: number \| null, hasArea = true\)[\s\S]*?if \(!hasArea\) return "Gebiet auswählen";/,
  "Ohne Flaeche darf der Verfuegbarkeitsstatus keine laufende Pruefung suggerieren.",
);
assertMatch(
  /deliverabilityLabel\(deliverabilityScore, hasPlanningArea\)/,
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
  areaStep,
  /boundarySelectionEnabled \? \([\s\S]*?data-testid="order-select-boundary"/,
  "Eine Grenzauswahl darf nur angezeigt werden, wenn Google die Boundary-Layer wirklich bereitstellt.",
);
assert.match(
  areaStep,
  /Klicke auf der Karte nacheinander auf die Eckpunkte[\s\S]*?Gebiet abschließen/,
  "Der Zeichenweg muss für Kunden ohne technische Erklärung verständlich sein.",
);
assert.match(
  wizard,
  /const boundarySelectionEnabled = boundaryLayerStatus === "available";/,
  "Die deutschlandweite Google-Grenzauswahl darf nicht von bereits gespeicherten FLYERO-Flaechen abhaengen.",
);
assert.doesNotMatch(
  wizard,
  /hasReusableBoundaryGeometry/,
  "Neue Orte duerfen nicht aus dem Google-Boundary-Layer ausgeschlossen werden, nur weil noch keine lokale Flaeche gespeichert ist.",
);
assert.match(
  areaStep,
  /boundarySelectionEnabled \? \([\s\S]*?data-testid="order-select-boundary"/,
  "Ein verfuegbarer Google-Layer allein darf keinen nicht buchbaren Grenzmodus anzeigen.",
);
assert.match(
  wizard,
  /if \(!area\) \{[\s\S]*?setAreaSelectionMode\("draw"\);[\s\S]*?Zeichne dein genaues Verteilgebiet direkt auf der Karte/,
  "Wenn Google nur eine placeId, aber keine uebernehmbare Flaeche liefert, muss der Kunde direkt zeichnen koennen.",
);
assert.match(
  wizard,
  /Ort gefunden\. Zeichne jetzt dein genaues Verteilgebiet direkt auf der Karte/,
  "Eine Boundary ohne gespeicherte FLYERO-Flaeche muss verstaendlich in den Zeichenmodus fuehren.",
);
assert.doesNotMatch(
  wizard,
  /Dieses Gebiet konnte nicht geladen werden/,
  "Ein Google-Boundary-Klick darf keinen irrefuehrenden Ladefehler im Kundenwizard anzeigen.",
);
assert.doesNotMatch(
  wizard,
  /keine fertige Gebietsfl[äa]che vor/,
  "Eine technische Boundary-Konfiguration darf Kunden nicht mit einer falschen Ortsaussage verwirren.",
);
assert.match(
  wizard,
  /const mapLocationLabel = \[postalCode, city\]\.filter\(Boolean\)\.join\(" "\) \|\| targetAreaName \|\| query \|\| "Deutschland";/,
  "Die Karte muss immer einen echten Such- oder Ortsbezug anzeigen und darf nicht ohne Ortsnamen bleiben.",
);
assert.match(
  wizard,
  /<span aria-live="polite">\{mapLocationLabel\}<\/span>/,
  "Der aktuelle Ortsname muss im Kartenkopf sichtbar aktualisiert werden.",
);
assert.match(
  wizard,
  /language=de&region=DE&libraries=places/,
  "Die Google-Karte muss fuer Kunden in Deutschland lokalisiert geladen werden.",
);
assert.match(
  wizard,
  /const scheduleInstallRetry = \(\) => \{[\s\S]*?retryCount >= 20[\s\S]*?window\.setTimeout\(\(\) => \{[\s\S]*?installBoundaryLayers\(\);/,
  "Boundary-Ebenen muessen nach dem asynchronen Kartenstil-Laden erneut geprueft werden.",
);
assert.match(
  wizard,
  /fetchPlace\?\.\(\)/,
  "Ein Boundary-Klick muss die von Google bereitgestellten Ortsdetails verwenden.",
);
assert.match(
  wizard,
  /new maps\.Geocoder\(\)/,
  "Ein Boundary-Klick muss bei fehlenden Ortsdetails den Google-Geocoder verwenden.",
);
assert.match(
  wizard,
  /fitBounds\(boundaryViewport\)/,
  "Ein ausgewähltes Google-Gebiet muss auf seinen echten Kartenbereich zoomen.",
);
assert.match(
  wizard,
  /setTargetAreaName\(boundaryLabel\)/,
  "Ein ausgewähltes Google-Gebiet muss seinen echten Ortsnamen im Wizard anzeigen.",
);

const migrationCommand = "docker compose -f docker-compose.production.yml run --rm app npx prisma migrate deploy";
assert.ok(deployment.includes(migrationCommand), "Das Produktions-Deployment muss Prisma-Migrationen vor dem Start ausfuehren.");
assert.match(
  wizard,
  /const removeSegment = useCallback[\s\S]*?setSelectedWarehouseId\(""\)[\s\S]*?setSelectedAreaId\(replacement\?\.distributionAreaId \?\? ""\)/,
  "Beim Entfernen eines Teilgebiets muessen Lager- und Gebietsreferenz zum verbleibenden Gebiet passen.",
);
const fullStackStart = deployment.search(/docker compose -f docker-compose\.production\.yml up -d\r?\n/);
assert.ok(fullStackStart >= 0 && deployment.indexOf(migrationCommand) < fullStackStart, "Migrationen muessen vor dem Produktionsstart dokumentiert sein.");
assert.match(dockerfile, /prisma migrate deploy && npm run start/, "Der Produktionscontainer muss vor Next.js den Prisma-Schemaabgleich ausfuehren.");

console.log("Customer planner integrity smoke checks passed.");
