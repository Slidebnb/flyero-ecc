import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let baseUrl = process.env.CUSTOMER_ORDER_CHECKOUT_BASE_URL || "http://localhost:3000";
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
  if (process.env.CUSTOMER_ORDER_CHECKOUT_BASE_URL) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/health`, { timeoutMs: 2500 });
      if (response.status < 500) return null;
    } catch {}
  }
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: new URL(baseUrl).port || "3000" },
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
  throw new Error("Dev-Server konnte fuer Customer Order Checkout Smoke nicht gestartet werden.");
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

async function postJson(path, body, cookie) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {}
  assert(response.status >= 200 && response.status < 300, `POST ${path} lieferte ${response.status}: ${text}`);
  return data;
}

function includes(filePath, snippets) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
  const content = readFileSync(filePath, "utf8");
  for (const snippet of snippets) assert(content.includes(snippet), `${filePath} enthaelt nicht: ${snippet}`);
  return content;
}

function orderPayload(suffix, completionPath) {
  return {
    serviceType: "FLYER_DISTRIBUTION",
    city: "Koblenz",
    postalCode: "56068",
    targetAreaName: `Checkout Smoke ${suffix}`,
    areaType: "POLYGON",
    targetAreaGeoJson: JSON.stringify({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [[[7.58, 50.35], [7.59, 50.35], [7.59, 50.36], [7.58, 50.36], [7.58, 50.35]]],
        },
      }],
    }),
    coverageAreaSqm: 640000,
    estimatedHouseholds: 2400,
    estimatedFlyers: 2700,
    estimatedDistanceMeters: 4200,
    areaCalculationSnapshot: JSON.stringify({
      source: "test",
      confidence: "medium",
      calculatedAt: new Date().toISOString(),
      calculationVersion: "order-area-v1",
      householdCountSource: "area-density-formula",
      pricingVersion: "pricing-rule-v1",
      areaReference: { targetAreaName: "Koblenz Smoke", postalCode: "56068", city: "Koblenz" },
    }),
    centerLat: 50.3569,
    centerLng: 7.589,
    flyerQuantity: 2700,
    flyerSource: "CUSTOMER_OWN",
    printDataStatus: "UPLOAD_LATER",
    completionPath,
    preferredStartDate: "2026-08-03",
    preferredEndDate: "2026-08-10",
    flexibleScheduling: true,
    contactPerson: "Smoke Kunde",
    contactPhone: "+49 261 123456",
    notes: "Smoke-Test Anfrage ohne Fake-Daten.",
  };
}

const server = await ensureServer();
try {
  includes("src/app/customer/orders/new/SmartOrderWizard.tsx", [
    "Jetzt buchen und bezahlen",
    "Unverbindlich anfragen",
    "Anfrageformular herunterladen",
    "Die Buchung wird nach Zahlung durch FLYERO geprüft.",
    "GPS-Nachweis",
    "Foto-Dokumentation",
    "PDF-Bericht",
  ]);
  includes("src/app/verteilung-anfragen/page.tsx", [
    "Direkt online buchen",
    "Unverbindlich anfragen",
    "Anfrageformular nutzen",
    "/downloads/flyero-anfrageformular.html",
    "mailto:",
  ]);
  includes("public/downloads/flyero-anfrageformular.html", [
    "FLYERO Anfrageformular",
    "Firma",
    "Ansprechpartner",
    "Verteilgebiet / PLZ / Ort",
    "Druck über FLYERO gewünscht",
  ]);

  const customerCookie = await login("kunde.immobilien@example.com");
  const direct = await postJson("/api/customer/orders", orderPayload("Direct", "direct_payment"), customerCookie);
  assert(direct.data.id, "Direktbuchung hat keine Order-ID geliefert.");
  assert(direct.data.status === "PAYMENT_PENDING", `Direktbuchung Status falsch: ${direct.data.status}`);

  const checkout = await postJson("/api/payments/checkout", { orderId: direct.data.id }, customerCookie);
  assert(checkout.data.checkoutUrl, "Checkout-URL fehlt.");
  assert(checkout.data.orderId === direct.data.id, "Payment ist nicht mit Order verknuepft.");

  const directOrder = await prisma.order.findUnique({ where: { id: direct.data.id }, include: { payments: true } });
  assert(directOrder?.priceRuleSnapshot?.areaCalculationSnapshot, "Area Calculation Snapshot fehlt bei Direktbuchung.");
  assert(directOrder?.priceRuleSnapshot?.completionPath === "direct_payment", "Abschlussweg direct_payment fehlt.");
  assert(directOrder?.priceRuleSnapshot?.printDataStatus === "UPLOAD_LATER", "Druckdatenstatus fehlt.");
  assert(directOrder.payments.length >= 1, "Payment wurde nicht angelegt.");

  const inquiry = await postJson("/api/customer/orders", orderPayload("Inquiry", "inquiry"), customerCookie);
  assert(inquiry.data.id, "Anfrage hat keine Order-ID geliefert.");
  assert(inquiry.data.status === "SUBMITTED", `Anfrage Status falsch: ${inquiry.data.status}`);
  const inquiryOrder = await prisma.order.findUnique({ where: { id: inquiry.data.id }, include: { payments: true } });
  assert(inquiryOrder?.payments.length === 0, "Anfrage darf keine Zahlung erzwingen.");
  assert(inquiryOrder?.priceRuleSnapshot?.completionPath === "inquiry", "Abschlussweg inquiry fehlt.");

  const download = await fetchWithTimeout(`${baseUrl}/downloads/flyero-anfrageformular.html`);
  assert(download.status === 200, `Anfrageformular Download liefert ${download.status}`);

  console.log("Customer Order Checkout Smoke-Test erfolgreich abgeschlossen.");
} finally {
  await prisma.$disconnect();
  if (server) server.kill();
}
