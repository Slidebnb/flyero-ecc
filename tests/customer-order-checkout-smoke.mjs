import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let baseUrl = process.env.CUSTOMER_ORDER_CHECKOUT_BASE_URL || "http://localhost:3000";
let createdSmokeWarehouseId = null;
const PASSWORD = "DemoPasswort123!";
const LOGIN_TEST_IP = process.env.SMOKE_TEST_IP || "198.51.100.24";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const checkoutRouteSource = readFileSync("src/app/api/payments/checkout/route.ts", "utf8");
const paymentsSource = readFileSync("src/lib/payments.ts", "utf8");
assert(checkoutRouteSource.includes("CustomerProfileIncompleteError"), "Checkout muss unvollständige Kundenprofile verständlich blockieren.");
assert(paymentsSource.includes("getCustomerProfileCompleteness"), "Checkout muss die zentrale Rechnungsdatenpruefung verwenden.");

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
    env: {
      ...process.env,
      NODE_ENV: "development",
      ENABLE_MOCK_PAYMENTS: "true",
      STRIPE_SECRET_KEY: "sk_test_mock",
      PORT: new URL(baseUrl).port || "3000",
    },
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

async function resetAuthRateLimitBuckets() {
  const ids = [
    createHash("sha256").update(`flyero-auth-rate-limit:login:ip:${LOGIN_TEST_IP}`).digest("hex"),
    createHash("sha256").update("flyero-auth-rate-limit:login:account:kunde.immobilien@example.com").digest("hex"),
    createHash("sha256").update("flyero-auth-rate-limit:login:account:admin@example.com").digest("hex"),
  ];
  await prisma.authRateLimitBucket.deleteMany({ where: { id: { in: ids } } });
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
      // Use a TEST-NET address so repeated local smoke runs do not share the developer's auth bucket.
    },
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

async function ensureCheckoutWarehouse() {
  const existing = await prisma.warehouse.findFirst({
    where: {
      isActive: true,
      isDemoData: false,
      regions: {
        some: { isActive: true, city: "Koblenz", postalCodes: { has: "560" } },
      },
    },
    select: { id: true },
  });
  if (existing) return;

  const warehouse = await prisma.warehouse.create({
    data: {
      name: "Checkout-Testlager",
      code: `SMOKE-CHECKOUT-${Date.now()}`,
      address: { street: "Teststraße", houseNumber: "1" },
      city: "Koblenz",
      postalCode: "56070",
      country: "DE",
      isActive: true,
      isDemoData: false,
      regions: {
        create: {
          name: "Checkout-Testregion Koblenz",
          city: "Koblenz",
          postalCodes: ["560"],
          isActive: true,
          priority: 100,
        },
      },
    },
    select: { id: true },
  });
  createdSmokeWarehouseId = warehouse.id;
}

const smokeSegment = {
  name: "Koblenz Checkout Smoke",
  city: "Koblenz",
  postalCode: "56068",
  district: "",
  country: "DE",
  geometryGeoJson: {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [[[7.58, 50.35], [7.59, 50.35], [7.59, 50.36], [7.58, 50.36], [7.58, 50.35]]],
      },
    }],
  },
};

function orderPayload(suffix, completionPath, quoteFingerprint, includeSegments = true) {
  return {
    serviceType: "FLYER_DISTRIBUTION",
    city: "Koblenz",
    postalCode: "56068",
    targetAreaName: `Checkout Smoke ${suffix}`,
    areaType: "POLYGON",
    targetAreaGeoJson: JSON.stringify(smokeSegment.geometryGeoJson),
    ...(includeSegments ? { areaSegments: JSON.stringify([smokeSegment]) } : {}),
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
      pricingVersion: "premium-distribution-v4",
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
    quoteFingerprint,
  };
}

async function planningQuote(completionPath, includeSegments = true) {
  const response = await fetchWithTimeout(`${baseUrl}/api/public/planner/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      city: "Koblenz",
      postalCode: "56068",
      flyerQuantity: 2700,
      targetAreaGeoJson: JSON.stringify(smokeSegment.geometryGeoJson),
      coverageAreaSqm: 640000,
      flyerSource: "CUSTOMER_OWN",
      printDataStatus: "UPLOAD_LATER",
      preferredStartDate: "2026-08-03",
      preferredEndDate: "2026-08-10",
      ...(includeSegments ? { segments: [smokeSegment] } : {}),
      completionPath,
    }),
  });
  const data = await response.json();
  assert(response.ok && data?.data?.metrics?.fingerprint, `Planungsquote fehlte: ${response.status} ${JSON.stringify(data)}`);
  return data.data.metrics.fingerprint;
}

const server = await ensureServer();
try {
  await resetAuthRateLimitBuckets();
  await ensureCheckoutWarehouse();
  includes("src/app/customer/orders/new/OrderFinishStep.tsx", [
    "Jetzt buchen und bezahlen",
    "Unverbindlich anfragen",
    "Anfrageformular herunterladen",
  ]);
  includes("src/app/customer/orders/new/SmartOrderWizard.tsx", [
    "Nach der Zahlung prüfen wir Gebiet, Druckdatei und ob die Verteilung wie geplant möglich ist.",
  ]);
  includes("src/app/customer/orders/new/OrderSummaryStep.tsx", [
    "GPS-Nachweis",
    "Foto-Dokumentation",
    "PDF-Bericht",
  ]);
  includes("src/app/verteilung-anfragen/page.tsx", [
    "Direkt online buchen",
    "Unverbindlich anfragen",
    "Anfrageformular nutzen",
    "/downloads/flyero-anfrageformular.pdf",
    "hallo@flyero.org",
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
  const adminCookie = await login("admin@example.com");
  const direct = await postJson("/api/customer/orders", orderPayload("Direct", "direct_payment", await planningQuote("direct_payment", false), false), customerCookie);
  assert(direct.data.id, "Direktbuchung hat keine Order-ID geliefert.");
  assert(direct.data.status === "PAYMENT_PENDING", `Direktbuchung Status falsch: ${direct.data.status}`);

  const concurrentCheckouts = await Promise.all([
    postJson("/api/payments/checkout", { orderId: direct.data.id }, customerCookie),
    postJson("/api/payments/checkout", { orderId: direct.data.id }, customerCookie),
  ]);
  for (const checkout of concurrentCheckouts) {
    assert(checkout.data.checkoutUrl, "Checkout-URL fehlt nach paralleler Anforderung.");
    assert(checkout.data.orderId === direct.data.id, "Payment ist nicht mit Order verknuepft.");
  }
  const directOrder = await prisma.order.findUnique({ where: { id: direct.data.id }, include: { payments: true } });
  assert(directOrder?.priceRuleSnapshot?.areaCalculationSnapshot, "Area Calculation Snapshot fehlt bei Direktbuchung.");
  assert(directOrder?.priceRuleSnapshot?.completionPath === "direct_payment", "Abschlussweg direct_payment fehlt.");
  assert(directOrder?.priceRuleSnapshot?.printDataStatus === "UPLOAD_LATER", "Druckdatenstatus fehlt.");
  assert(directOrder?.priceRuleSnapshot?.pricingVersion === "premium-distribution-v4", "Premium Pricing-Version fehlt im Snapshot.");
  assert(typeof directOrder?.priceRuleSnapshot?.pricingRuleSignature === "string", "Preis-Konfigurationssignatur fehlt im Snapshot.");
  assert(directOrder?.priceRuleSnapshot?.minimumOrderValueNet === "599", "Mindestauftragswert fehlt im Snapshot.");
  assert(directOrder?.priceRuleSnapshot?.tier1Rate === "0.38", "Tier 1 Rate fehlt im Snapshot.");
  assert(directOrder?.priceRuleSnapshot?.tier2Rate === "0.34", "Tier 2 Rate fehlt im Snapshot.");
  assert(directOrder?.priceRuleSnapshot?.tier3Rate === "0.31", "Tier 3 Rate fehlt im Snapshot.");
  assert(directOrder?.priceRuleSnapshot?.calculatedNet === directOrder?.calculatedNetPrice.toString(), "Netto-Snapshot stimmt nicht mit Order-Preis ueberein.");
  assert(directOrder.payments.length >= 1, "Payment wurde nicht angelegt.");

  const inquiry = await postJson("/api/customer/orders", orderPayload("Inquiry", "inquiry"), customerCookie);
  assert(inquiry.data.id, "Anfrage hat keine Order-ID geliefert.");
  assert(inquiry.data.status === "SUBMITTED", `Anfrage Status falsch: ${inquiry.data.status}`);
  const inquiryOrder = await prisma.order.findUnique({ where: { id: inquiry.data.id }, include: { payments: true } });
  assert(inquiryOrder?.payments.length === 0, "Anfrage darf keine Zahlung erzwingen.");
  assert(inquiryOrder?.priceRuleSnapshot?.completionPath === "inquiry", "Abschlussweg inquiry fehlt.");

  const inquiryWithoutPolygonPayload = orderPayload("Inquiry Without Polygon", "inquiry", undefined, false);
  delete inquiryWithoutPolygonPayload.targetAreaGeoJson;
  delete inquiryWithoutPolygonPayload.coverageAreaSqm;
  delete inquiryWithoutPolygonPayload.estimatedHouseholds;
  delete inquiryWithoutPolygonPayload.estimatedDistanceMeters;
  inquiryWithoutPolygonPayload.areaType = "POSTAL_CODE";
  const inquiryWithoutPolygon = await postJson("/api/customer/orders", inquiryWithoutPolygonPayload, customerCookie);
  assert(inquiryWithoutPolygon.data.id, "Anfrage ohne Polygon hat keine Order-ID geliefert.");
  assert(inquiryWithoutPolygon.data.status === "SUBMITTED", `Anfrage ohne Polygon Status falsch: ${inquiryWithoutPolygon.data.status}`);
  const inquiryWithoutPolygonOrder = await prisma.order.findUnique({ where: { id: inquiryWithoutPolygon.data.id }, include: { payments: true } });
  assert(inquiryWithoutPolygonOrder?.payments.length === 0, "Eine Anfrage ohne Polygon darf keine Zahlung erzwingen.");

  const manual = await postJson("/api/customer/orders", orderPayload("Manual", "direct_payment", await planningQuote("direct_payment", false), false), customerCookie);
  await postJson(`/api/admin/orders/${manual.data.id}/price`, { manualPriceOverride: "1000", note: "Manual pricing smoke." }, adminCookie);
  const manualCheckout = await postJson("/api/payments/checkout", { orderId: manual.data.id }, customerCookie);
  assert(manualCheckout.data.checkoutUrl, "Checkout fuer individuellen Nettopreis fehlt.");
  const manualOrder = await prisma.order.findUnique({ where: { id: manual.data.id }, include: { payments: true } });
  assert(manualOrder?.calculatedNetPrice.toString() === "1000", "Individueller Nettopreis wurde nicht gespeichert.");
  assert(manualOrder?.calculatedVat.toString() === "190", "MwSt. fuer individuellen Nettopreis ist falsch.");
  assert(manualOrder?.calculatedGrossPrice.toString() === "1190", "Bruttopreis fuer individuellen Nettopreis ist falsch.");
  assert(manualOrder?.payments[0]?.amount.toString() === "1190", "Checkout darf beim individuellen Nettopreis nicht die Netto-Summe abbuchen.");
  assert(manualOrder?.priceRuleSnapshot?.manualCalculatedGross === "1190", "Individueller Bruttopreis fehlt im Snapshot.");

  const download = await fetchWithTimeout(`${baseUrl}/downloads/flyero-anfrageformular.pdf`);
  assert(download.status === 200, `Anfrageformular PDF liefert ${download.status}`);

  console.log("Customer Order Checkout Smoke-Test erfolgreich abgeschlossen.");
} finally {
  if (createdSmokeWarehouseId) {
    await prisma.warehouse.delete({ where: { id: createdSmokeWarehouseId } });
  }
  await prisma.$disconnect();
  if (server) server.kill();
}
