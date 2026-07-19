import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let baseUrl = process.env.CUSTOMER_ORDER_AREA_BASE_URL || "http://localhost:3000";
const PASSWORD = "DemoPasswort123!";
const LOGIN_TEST_IP = process.env.SMOKE_TEST_IP || "198.51.100.31";
const MAPS_TEST_IP = process.env.SMOKE_MAPS_IP || "198.51.100.201";

async function resetMapsRateLimitBucket() {
  const mapsId = createHash("sha256")
    .update(`flyero-public-rate-limit:maps:${MAPS_TEST_IP}`)
    .digest("hex");
  await prisma.publicRateLimitBucket.deleteMany({ where: { id: mapsId } });

  const loginIpId = createHash("sha256")
    .update(`flyero-auth-rate-limit:login:ip:${LOGIN_TEST_IP}`)
    .digest("hex");
  const loginAccountId = createHash("sha256")
    .update("flyero-auth-rate-limit:login:account:kunde.immobilien@example.com")
    .digest("hex");
  await prisma.authRateLimitBucket.deleteMany({ where: { id: { in: [loginIpId, loginAccountId] } } });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 7000);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timer);
  }
}

async function ensureServer() {
  for (const candidate of [baseUrl, "http://localhost:3000", "http://localhost:3001", "http://localhost:3025"]) {
    try {
      baseUrl = candidate;
      const response = await fetchWithTimeout(`${baseUrl}/api/health`, { timeoutMs: 2500 });
      if (response.status < 500) return null;
    } catch {}
  }
  baseUrl = "http://localhost:3000";
  const child = spawn(process.platform === "win32" ? process.execPath : "npm", process.platform === "win32"
    ? ["node_modules/next/dist/bin/next", "dev", "-p", "3000"]
    : ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: "3000" },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 45; attempt += 1) {
    await sleep(1000);
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/health`);
      if (response.status < 500) return child;
    } catch {}
  }
  child.kill();
  throw new Error("Dev-Server konnte fuer Customer Order Area Smoke nicht gestartet werden.");
}

function cookieHeaderFrom(response) {
  return (response.headers.get("set-cookie") || "").split(/,(?=[^;,]+=)/).map((item) => item.split(";")[0]).join("; ");
}

async function login(email) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": LOGIN_TEST_IP,
    },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert(response.status === 200, `Login fehlgeschlagen fuer ${email}: ${response.status} ${await response.text()}`);
  return cookieHeaderFrom(response);
}

async function json(path, { cookie }) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    headers: {
      cookie,
      "x-forwarded-for": MAPS_TEST_IP,
    },
  });
  const text = await response.text();
  assert(response.status === 200, `GET ${path} lieferte ${response.status}: ${text}`);
  return JSON.parse(text);
}

function includes(filePath, snippets) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
  const content = readFileSync(filePath, "utf8");
  for (const snippet of snippets) assert(content.includes(snippet), `${filePath} enthaelt nicht: ${snippet}`);
  return content;
}

function recommendedFlyers(households) {
  return Math.max(100, Math.ceil((households * 1.1) / 100) * 100);
}

const premiumPricingExamples = [
  [100, "599"],
  [500, "599"],
  [1000, "599"],
  [1500, "599"],
  [2000, "760"],
  [3000, "1140"],
  [5000, "1900"],
  [5001, "1900.34"],
  [7500, "2750"],
  [10000, "3600"],
  [10001, "3600.31"],
  [15000, "5150"],
  [20000, "6700"],
];

const server = await ensureServer();
try {
  await resetMapsRateLimitBucket();
  const customerCookie = await login("kunde.immobilien@example.com");
  const wizard = includes("src/app/customer/orders/new/SmartOrderWizard.tsx", [
    "findAreaForLocation",
    "setIntelligence(null)",
    "areaCalculationSnapshot",
    "mapNotice",
    "setMapTypeId",
    "Dein Gebiet wurde auf der Karte angepasst.",
    "Neues Gebiet \u00fcbernehmen",
    "Aktuelles Gebiet behalten",
    "orderNavGroups",
    "customerSideNavSection",
    'className="orderSideNav customerSideNav"',
    "overviewDragHandle",
    "onPointerMove={moveOverviewDrag}",
    "Aktualisiert sich, sobald du das Gebiet",
    "NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID",
    "getFeatureLayer",
    "POSTAL_CODE",
    "LOCALITY",
    "Gebiet ausw\u00e4hlen",
    "Eigenes Gebiet zeichnen",
  ]);
  assert(!wizard.includes("Math.random"), "Wizard darf keine Zufallswerte fuer Gebietsuebersicht nutzen.");
  for (const forbidden of ["8.414", "8414", "1.249,50", "1249.50", "FeatureCollection</", "GeoJSON</"]) {
    assert(!wizard.includes(forbidden), `Wizard enthaelt verbotenen Dummy-/Techniktext: ${forbidden}`);
  }
  const overviewStart = wizard.indexOf('className="areaOverview"');
  const overviewEnd = wizard.indexOf("</aside>", overviewStart);
  const overview = overviewStart >= 0 && overviewEnd > overviewStart ? wizard.slice(overviewStart, overviewEnd) : "";
  assert(overview, "Gebietsuebersicht wurde im Wizard nicht gefunden.");
  assert(overview.includes("Empfohlene Flyerzahl</dt>"), "Gebietsuebersicht zeigt die Flyerempfehlung nicht.");
  for (const removedLabel of ["Haushalte</dt>", "Laufstrecke</dt>", "Zustelldauer</dt>", "Benötigte Verteiler</dt>"]) {
    assert(!overview.includes(removedLabel), `Gebietsuebersicht zeigt entfernte Kennzahl: ${removedLabel}`);
  }

  const smartMaps = includes("src/lib/smartMaps.ts", [
    "householdCountSource",
    "order-area-v1",
    "pricingVersion",
    "singleDistributorMinutes",
    "distributionArea.findMany",
  ]);
  assert(!smartMaps.includes("LOCAL_PLACES"), "Smart Maps darf keine lokal hartcodierten Ortsdaten als echte Vorschläge ausgeben.");
  includes("src/lib/pricing.ts", [
    "premium-distribution-v4",
    "calculatePremiumDistributionNetPrice",
    "minimumOrderValueNet",
    "tier1Rate",
    "tier2Rate",
    "tier3Rate",
  ]);
  assert(!smartMaps.includes("input.households ??"), "Server darf Browser-Haushalte nicht als Wahrheit uebernehmen.");

  const areas = await prisma.distributionArea.findMany({
    where: { status: "ACTIVE", reusable: true, city: { in: ["Koblenz", "Bendorf", "Neuwied"] }, geoJson: { not: Prisma.DbNull } },
    select: { city: true, postalCode: true, estimatedFlyers: true, coverageAreaSqm: true },
    orderBy: [{ city: "asc" }, { coverageAreaSqm: "desc" }],
  });
  const areaByCity = new Map();
  for (const area of areas) {
    if (!areaByCity.has(area.city)) areaByCity.set(area.city, area);
  }
  for (const city of ["Koblenz", "Bendorf", "Neuwied"]) assert(areaByCity.has(city), `Aktives Gebiet fuer ${city} fehlt.`);

  const geocodes = await Promise.all([
    json("/api/maps/geocode?q=56068%20Koblenz", { cookie: customerCookie }),
    json("/api/maps/geocode?q=56170%20Bendorf", { cookie: customerCookie }),
    json("/api/maps/geocode?q=56564%20Neuwied", { cookie: customerCookie }),
  ]);
  assert(geocodes[0].data.city === "Koblenz", "Koblenz-Geocode stimmt nicht.");
  assert(geocodes[1].data.city === "Bendorf", "Bendorf-Geocode stimmt nicht.");
  assert(geocodes[2].data.city === "Neuwied", "Neuwied-Geocode stimmt nicht.");
  assert(new Set(geocodes.map((item) => `${item.data.lat}:${item.data.lng}`)).size === 3, "PLZ-Wechsel liefert keine unterschiedlichen Karten-Zentren.");
  const placeSuggestions = await json("/api/maps/autocomplete?q=56170", { cookie: customerCookie });
  const googlePlace = placeSuggestions.data.find((item) => item.source === "google");
  assert(googlePlace?.id, "Google-PLZ-Vorschlag fehlt.");
  const selectedPlaceGeocode = await json(`/api/maps/geocode?q=56170&placeId=${encodeURIComponent(googlePlace.id)}`, { cookie: customerCookie });
  assert(selectedPlaceGeocode.data.postalCode === "56170", "Ausgewählter Google-PLZ-Vorschlag wird nicht korrekt geocodiert.");
  assert(typeof selectedPlaceGeocode.data.lat === "number" && typeof selectedPlaceGeocode.data.lng === "number", "Ausgewählter Google-PLZ-Vorschlag liefert keine Koordinaten.");
  const publicSelectedResponse = await fetchWithTimeout(`${baseUrl}/api/public/planner/geocode?q=56170&placeId=${encodeURIComponent(googlePlace.id)}`, {
    headers: { "x-forwarded-for": "198.51.100.202" },
  });
  const publicSelectedPlaceGeocode = await publicSelectedResponse.json();
  assert(publicSelectedResponse.status === 200, `Öffentliche Google-PLZ-Auswahl lieferte ${publicSelectedResponse.status}: ${JSON.stringify(publicSelectedPlaceGeocode)}`);
  assert(publicSelectedPlaceGeocode.data.postalCode === "56170", "Öffentliche Google-PLZ-Auswahl wird nicht korrekt geocodiert.");

  const intelligence = [];
  for (const city of ["Koblenz", "Bendorf", "Neuwied"]) {
    const area = areaByCity.get(city);
    const coverageAreaSqm = Number(area.coverageAreaSqm);
    const flyerQuantity = area.estimatedFlyers ?? 2500;
    intelligence.push(await json(`/api/maps/order-intelligence?city=${encodeURIComponent(city)}&postalCode=${area.postalCode}&coverageAreaSqm=${coverageAreaSqm}&flyerQuantity=${flyerQuantity}`, { cookie: customerCookie }));
  }
  const households = intelligence.map((item) => item.data.metrics.households);
  const prices = intelligence.map((item) => item.data.metrics.grossPrice);
  assert(new Set(households).size >= 2, "PLZ-Wechsel aendert Haushalte nicht.");
  assert(new Set(prices).size >= 2, "PLZ-Wechsel aendert Preisvorschau nicht.");
  for (const item of intelligence) {
    if (item.data.metrics.needsManualReview) {
      assert(item.data.warehouse === null, "Gebiet ohne aktive Logistik darf kein Lager als bestaetigt anzeigen.");
    } else {
      assert(item.data.warehouse?.city, "Naechstes Lager wird fuer ein logistisch bestaetigtes Gebiet nicht berechnet.");
    }
  }
  for (const item of intelligence) {
    assert(item.data.metrics.confidence, "Confidence fehlt.");
    assert(item.data.metrics.source, "Berechnungsquelle fehlt.");
    assert(item.data.metrics.householdCountSource, "Household-Quelle fehlt.");
    assert(item.data.metrics.pricingVersion === "premium-distribution-v4", "Pricing-Version fehlt.");
    assert(item.data.metrics.areaReference, "Area-Referenz fehlt.");
    assert(item.data.metrics.calculatedAt, "Berechnungszeitpunkt fehlt.");
    assert(item.data.metrics.calculationVersion === "order-area-v1", "Calculation-Version fehlt.");
    assert(item.data.metrics.distributorNeed >= 1, "Verteilerbedarf fehlt.");
    assert(item.data.metrics.score >= 0, "Verteilbarkeitsscore fehlt.");
  }

  const koblenz = areaByCity.get("Koblenz");
  const smallArea = Number(koblenz.coverageAreaSqm);
  const largeArea = Math.round(smallArea * 1.8);
  const small = await json(`/api/maps/order-intelligence?city=Koblenz&postalCode=${koblenz.postalCode}&coverageAreaSqm=${smallArea}&flyerQuantity=${recommendedFlyers(Math.round(smallArea / 125))}`, { cookie: customerCookie });
  const large = await json(`/api/maps/order-intelligence?city=Koblenz&postalCode=${koblenz.postalCode}&coverageAreaSqm=${largeArea}&flyerQuantity=${recommendedFlyers(Math.round(largeArea / 125))}`, { cookie: customerCookie });
  assert(large.data.metrics.households > small.data.metrics.households, "Manuelle Gebietsgroesse aendert Haushalte nicht.");
  assert(large.data.metrics.routeDistanceMeters > small.data.metrics.routeDistanceMeters, "Manuelle Gebietsgroesse aendert Laufstrecke nicht.");
  assert(Number(large.data.metrics.grossPrice) > Number(small.data.metrics.grossPrice), "Manuelle Gebietsgroesse aendert Preis nicht.");

  const pricingQuotes = new Map();
  for (const [flyerQuantity, expectedNet] of premiumPricingExamples) {
    const quote = await json(`/api/maps/order-intelligence?city=Koblenz&postalCode=${koblenz.postalCode}&coverageAreaSqm=${smallArea}&flyerQuantity=${flyerQuantity}`, { cookie: customerCookie });
    assert(quote.data.metrics.netPrice === expectedNet, `${flyerQuantity} Flyer: erwartet ${expectedNet} netto, bekam ${quote.data.metrics.netPrice}`);
    pricingQuotes.set(flyerQuantity, quote.data.metrics.netPrice);
  }
  assert(Number(pricingQuotes.get(5001)) > Number(pricingQuotes.get(5000)), "Preis darf an 5.000/5.001 nicht fallen.");
  assert(Number(pricingQuotes.get(10001)) > Number(pricingQuotes.get(10000)), "Preis darf an 10.000/10.001 nicht fallen.");

  const page = await fetchWithTimeout(`${baseUrl}/customer/orders/new`, { headers: { cookie: customerCookie } });
  const html = await page.text();
  assert(page.status === 200, `/customer/orders/new lieferte ${page.status}`);
  const visible = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<input[^>]*type="hidden"[^>]*>/gi, "");
  for (const forbidden of ["GeoJSON", "FeatureCollection", "interne ID", "technischer Fehler", "NEXT_PUBLIC", "Google Maps Key fehlt"]) {
    assert(!visible.includes(forbidden), `Sichtbarer technischer Begriff gefunden: ${forbidden}`);
  }

  console.log("Customer Order Area Smoke-Test erfolgreich abgeschlossen.");
} finally {
  await prisma.$disconnect();
  if (server) server.kill();
}
