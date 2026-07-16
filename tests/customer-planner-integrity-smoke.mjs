import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const pricingPage = readFileSync("src/app/preise/page.tsx", "utf8");
const pricing = readFileSync("src/lib/pricing.ts", "utf8");
const smartMaps = readFileSync("src/lib/smartMaps.ts", "utf8");
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
  /Gebiet auf der Karte ausw[aä]hlen/,
  "Bei fehlender Flaeche muss der Kunde eine klare naechste Aktion sehen.",
);

assertMatch(
  /Math\.max\(MINIMUM_FLYER_QUANTITY, Math\.ceil\(\(Math\.max\(0, households\) \* 1\.1\) \/ 100\) \* 100\)/,
  "Ohne Flaeche darf die Empfehlung nicht kuenstlich auf 500 Flyer springen.",
);
assert.match(
  smartMaps,
  /Math\.max\(MINIMUM_FLYER_QUANTITY, Math\.ceil\(\(households \* 1\.1\) \/ 100\) \* 100\)/,
  "Server und Kundenwizard muessen dieselbe Mindestempfehlung verwenden.",
);
assertMatch(
  /setMapNotice\("Standort wird gesucht\.\.\."\);/,
  "Eine neue PLZ-Suche muss den alten Suchhinweis sofort ersetzen.",
);

const migrationCommand = "docker compose -f docker-compose.production.yml run --rm app npx prisma migrate deploy";
assert.ok(deployment.includes(migrationCommand), "Das Produktions-Deployment muss Prisma-Migrationen vor dem Start ausfuehren.");
const fullStackStart = deployment.search(/docker compose -f docker-compose\.production\.yml up -d\r?\n/);
assert.ok(fullStackStart >= 0 && deployment.indexOf(migrationCommand) < fullStackStart, "Migrationen muessen vor dem Produktionsstart dokumentiert sein.");
assert.match(dockerfile, /prisma migrate deploy && npm run start/, "Der Produktionscontainer muss vor Next.js den Prisma-Schemaabgleich ausfuehren.");

console.log("Customer planner integrity smoke checks passed.");
