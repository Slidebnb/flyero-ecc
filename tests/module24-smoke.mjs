import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let baseUrl = process.env.MODULE24_BASE_URL || `http://localhost:${process.env.MODULE24_PORT || "3025"}`;
const PASSWORD = "DemoPasswort123!";
const TEST_IP = process.env.SMOKE_MAPS_IP || `198.51.100.${(Date.now() % 200) + 20}`;

async function resetTestRateLimits() {
  if (process.env.NODE_ENV === "production") return;
  const ids = [
    createHash("sha256").update(`flyero-auth-rate-limit:login:ip:${TEST_IP}`).digest("hex"),
    createHash("sha256").update("flyero-auth-rate-limit:login:account:kunde.immobilien@example.com").digest("hex"),
    createHash("sha256").update("flyero-auth-rate-limit:login:account:admin@example.com").digest("hex"),
  ];
  await prisma.authRateLimitBucket.deleteMany({ where: { id: { in: ids } } });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timer);
  }
}

async function ensureServer() {
  for (const candidate of [baseUrl, "http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"]) {
    try {
      baseUrl = candidate;
      const response = await fetchWithTimeout(`${baseUrl}/api/health`);
      if (response.status < 500) return null;
    } catch {}
  }
  baseUrl = process.env.MODULE24_BASE_URL || `http://localhost:${process.env.MODULE24_PORT || "3025"}`;
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: new URL(baseUrl).port || "3025" },
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
  throw new Error("Dev-Server konnte fuer Modul 24 nicht gestartet werden.");
}

function cookieHeaderFrom(response) {
  return (response.headers.get("set-cookie") || "").split(/,(?=[^;,]+=)/).map((item) => item.split(";")[0]).join("; ");
}

async function login(email) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": TEST_IP,
    },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert(response.status === 200, `Login fehlgeschlagen fuer ${email}: ${response.status} ${await response.text()}`);
  return cookieHeaderFrom(response);
}

async function json(path, { cookie = "", expected = [200] } = {}) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    headers: {
      "x-forwarded-for": TEST_IP,
      ...(cookie ? { cookie } : {}),
    },
  });
  const text = await response.text();
  assert(expected.includes(response.status), `GET ${path} erwartete ${expected.join("/")} bekam ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function includes(path, snippets) {
  assert(existsSync(path), `${path} fehlt.`);
  const content = readFileSync(path, "utf8");
  for (const snippet of snippets) assert(content.includes(snippet), `${path} enthaelt nicht: ${snippet}`);
}

function includesContent(label, content, snippets) {
  for (const snippet of snippets) assert(content.includes(snippet), `${label} enthaelt nicht: ${snippet}`);
}

const customerOrderFlow = [
  "SmartOrderWizard.tsx",
  "OrderAreaStep.tsx",
  "OrderMaterialStep.tsx",
  "OrderScheduleStep.tsx",
  "OrderSummaryStep.tsx",
  "OrderFinishStep.tsx",
].map((file) => readFileSync(`src/app/customer/orders/new/${file}`, "utf8")).join("\n");

const server = await ensureServer();
try {
  await resetTestRateLimits();
  const customerCookie = await login("kunde.immobilien@example.com");
  const adminCookie = await login("admin@example.com");

  includesContent("Kunden-Bestellflow", customerOrderFlow, [
    "orderExperience",
    "/api/maps/autocomplete",
    "/api/maps/geocode",
    "/api/maps/order-intelligence",
    "Gebiet",
    "replaceAreaNotice",
    "polygonSource",
    "Flyer",
    "Verteilung",
    "Zeitraum",
    "Preis pr\u00fcfen",
    "Abschluss",
    "areaOverview",
    "Karte gerade nicht verfügbar",
    "Satellit",
    "orderStepPanel",
  ]);
  includes("src/lib/routing.ts", [
    "calculateWalkingRoute",
    "calculateBestDistributor",
    "calculateDistributionTime",
    "calculateDistance",
    "clusterOrders",
    "combineOrders",
    "estimateFlyerTime",
    "estimateHouseholds",
    "scoreArea",
  ]);
  includes("src/lib/smartMaps.ts", ["getPlaceAutocomplete", "geocodeSmartAddress", "getOrderIntelligence", "getHeatmapData", "getOrderExperienceAnalytics"]);
  includes("prisma/schema.prisma", ["OrderExperienceEvent", "usedAutocomplete", "usedSavedArea", "routeDurationMinutes"]);

  const autocomplete = await json("/api/maps/autocomplete?q=56068", { cookie: customerCookie });
  assert(
    autocomplete.data.some((item) => item.city === "Koblenz" || item.description?.includes("Koblenz") || item.label?.includes("Koblenz")),
    "Autocomplete liefert keinen sichtbaren Ortsbezug fuer 56068.",
  );

  const cityJump = await json("/api/maps/geocode?q=Neuwied", { cookie: customerCookie });
  assert(cityJump.data.city === "Neuwied" || cityJump.data.label.includes("Neuwied"), "Ort-Sprung Neuwied funktioniert nicht.");

  const addressJump = await json("/api/maps/geocode?postalCode=56068&city=Koblenz&street=Schlossstrasse", { cookie: customerCookie });
  assert(Number.isFinite(addressJump.data.lat) && Number.isFinite(addressJump.data.lng), "Adress-Sprung liefert keine Koordinaten.");

  const targetAreaGeoJson = encodeURIComponent(JSON.stringify({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[[7.58, 50.35], [7.59, 50.35], [7.59, 50.36], [7.58, 50.36], [7.58, 50.35]]] },
    }],
  }));
  const intelligence = await json(`/api/maps/order-intelligence?city=Koblenz&postalCode=56068&targetAreaGeoJson=${targetAreaGeoJson}&coverageAreaSqm=900000&flyerQuantity=2200`, { cookie: customerCookie });
  assert(intelligence.data.metrics.grossPrice, "Live Preis fehlt.");
  assert(intelligence.data.metrics.households > 0, "Live Haushalte fehlen.");
  assert(intelligence.data.metrics.flyerQuantity > 0, "Live Flyer fehlen.");
  assert(
    intelligence.data.warehouse?.name || intelligence.data.metrics.needsManualReview === true,
    "Gebiet muss entweder einem aktiven Lager zugeordnet oder zur manuellen Prüfung markiert werden.",
  );
  assert(intelligence.data.metrics.routeDistanceMeters > 0, "Routing-Distanz fehlt.");
  assert(intelligence.data.metrics.routeDurationMinutes > 0, "Routing-Zeit fehlt.");

  const heatmap = await json("/api/admin/maps/heatmap", { cookie: adminCookie });
  assert(Array.isArray(heatmap.data.load), "Heatmap-Daten fehlen.");

  const combinations = await json("/api/admin/dispatch/combinations", { cookie: adminCookie });
  assert(Array.isArray(combinations.data), "Tourkombinationen liefern keine Liste.");

  const events = await prisma.orderExperienceEvent.count();
  assert(events >= 5, "Modul-24-Analytics-Events fehlen im Seed.");
  const autocompleteEvents = await prisma.orderExperienceEvent.count({ where: { usedAutocomplete: true } });
  assert(autocompleteEvents >= 1, "Autocomplete-Nutzung wird nicht erfasst.");

  const page = await fetchWithTimeout(`${baseUrl}/customer/orders/new`, { headers: { cookie: customerCookie } });
  const html = await page.text();
  assert(page.status === 200, `Smart Order Wizard Seite liefert ${page.status}`);
  assert(html.includes("Neue Kampagne starten") && html.includes("orderExperience"), "Smart Order Wizard rendert nicht.");

  console.log("Modul 24 Smoke-Test erfolgreich abgeschlossen.");
} finally {
  await prisma.$disconnect();
  if (server) server.kill();
}

