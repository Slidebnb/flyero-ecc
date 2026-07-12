import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let baseUrl = process.env.CUSTOMER_ORDER_AREA_BASE_URL || "http://localhost:3000";
const PASSWORD = "DemoPasswort123!";

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
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: "3000" },
    stdio: "ignore",
    shell: process.platform === "win32",
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
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert(response.status === 200, `Login fehlgeschlagen fuer ${email}: ${response.status} ${await response.text()}`);
  return cookieHeaderFrom(response);
}

async function json(path, { cookie }) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, { headers: { cookie } });
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
  return Math.max(500, Math.ceil((households * 1.1) / 100) * 100);
}

const server = await ensureServer();
try {
  const customerCookie = await login("kunde.immobilien@example.com");
  const wizard = includes("src/app/customer/orders/new/SmartOrderWizard.tsx", [
    "findAreaForLocation",
    "setIntelligence(null)",
    "areaCalculationSnapshot",
    "Heatmap f\u00fcr dieses Gebiet noch nicht verf\u00fcgbar.",
    "setMapTypeId",
    "Du hast dein Gebiet manuell angepasst.",
    "Neues Gebiet \u00fcbernehmen",
    "Aktuelles Gebiet behalten",
  ]);
  assert(!wizard.includes("Math.random"), "Wizard darf keine Zufallswerte fuer Gebietsuebersicht nutzen.");
  for (const forbidden of ["8.414", "8414", "1.249,50", "1249.50", "FeatureCollection</", "GeoJSON</"]) {
    assert(!wizard.includes(forbidden), `Wizard enthaelt verbotenen Dummy-/Techniktext: ${forbidden}`);
  }

  const smartMaps = includes("src/lib/smartMaps.ts", [
    "householdCountSource",
    "order-area-v1",
    "pricingVersion",
    "singleDistributorMinutes",
    "local-56170",
  ]);
  includes("src/lib/pricing.ts", ["pricing-rule-v1"]);
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

  const intelligence = [];
  for (const city of ["Koblenz", "Bendorf", "Neuwied"]) {
    const area = areaByCity.get(city);
    const coverageAreaSqm = Number(area.coverageAreaSqm);
    const flyerQuantity = area.estimatedFlyers ?? 2500;
    intelligence.push(await json(`/api/maps/order-intelligence?city=${encodeURIComponent(city)}&postalCode=${area.postalCode}&coverageAreaSqm=${coverageAreaSqm}&flyerQuantity=${flyerQuantity}`, { cookie: customerCookie }));
  }
  const households = intelligence.map((item) => item.data.metrics.households);
  const prices = intelligence.map((item) => item.data.metrics.grossPrice);
  const warehouses = intelligence.map((item) => item.data.warehouse?.city || "");
  assert(new Set(households).size >= 2, "PLZ-Wechsel aendert Haushalte nicht.");
  assert(new Set(prices).size >= 2, "PLZ-Wechsel aendert Preisvorschau nicht.");
  assert(warehouses.every(Boolean), "Naechstes Lager wird nicht berechnet.");
  for (const item of intelligence) {
    assert(item.data.metrics.confidence, "Confidence fehlt.");
    assert(item.data.metrics.source, "Berechnungsquelle fehlt.");
    assert(item.data.metrics.householdCountSource, "Household-Quelle fehlt.");
    assert(item.data.metrics.pricingVersion === "pricing-rule-v1", "Pricing-Version fehlt.");
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
