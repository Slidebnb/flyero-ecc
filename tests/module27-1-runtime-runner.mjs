import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const baseUrl = process.env.MODULE27_1_BASE_URL || "http://127.0.0.1:3000";
const password = "DemoPasswort123!";
const smokeIp = process.env.MODULE27_1_SMOKE_IP || `198.51.100.${(Date.now() % 200) + 1}`;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let serverOutput = "";

function assertOk(condition, message) {
  assert.equal(Boolean(condition), true, message);
}

function cookieHeader(response) {
  return (response.headers.get("set-cookie") || "")
    .split(/,(?=[^;,]+=)/)
    .map((item) => item.split(";")[0])
    .join("; ");
}

async function request(path, options = {}) {
  const controller = options.signal ? null : new AbortController();
  const timeout = controller ? setTimeout(() => controller.abort(), 15_000) : null;
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
      ...options,
      headers: { ...(options.headers ?? {}) },
      signal: options.signal ?? controller?.signal,
    });
  } catch (error) {
    throw new Error(`${options.method ?? "GET"} ${path} konnte nicht beantwortet werden: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data, text };
}

async function ensureServer() {
  try {
    const health = await request("/api/health");
    if (health.response.status < 500) return null;
  } catch {}

  const port = new URL(baseUrl).port || "3000";
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  child.stdout?.on("data", (chunk) => { serverOutput += chunk.toString(); });
  child.stderr?.on("data", (chunk) => { serverOutput += chunk.toString(); });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(1000);
    try {
      const health = await request("/api/health");
      if (health.response.status < 500) return child;
    } catch {}
  }
  child.kill();
  if (serverOutput) console.error(serverOutput);
  throw new Error(`Testserver ${baseUrl} konnte nicht gestartet werden.`);
}

async function login(email) {
  const result = await request("/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": smokeIp,
    },
    body: JSON.stringify({ email, password }),
  });
  assertOk(result.response.status === 200, `Login ${email} fehlgeschlagen: ${result.response.status} ${result.text}`);
  return cookieHeader(result.response);
}

async function jsonRequest(path, method, body, cookie) {
  const result = await request(path, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  assertOk(result.response.status >= 200 && result.response.status < 300, `${method} ${path}: ${result.response.status} ${result.text}`);
  return result.data;
}

function dates() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 8);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function segment(name, city, postalCode, offset = 0) {
  const left = 7.58 + offset;
  const bottom = 50.35 + offset / 8;
  return {
    name,
    city,
    postalCode,
    district: "",
    country: "DE",
    geometryGeoJson: {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [[[left, bottom], [left + 0.01, bottom], [left + 0.01, bottom + 0.01], [left, bottom + 0.01], [left, bottom]]],
        },
      }],
    },
  };
}

async function quote(segments, flyerQuantity, completionPath) {
  const date = dates();
  const result = await request("/api/public/planner/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      city: segments[0].city,
      postalCode: segments[0].postalCode,
      flyerQuantity,
      coverageAreaSqm: segments.length * 640000,
      flyerSource: "CUSTOMER_OWN",
      printDataStatus: "UPLOAD_LATER",
      preferredStartDate: date.start,
      preferredEndDate: date.end,
      segments,
      completionPath,
    }),
  });
  assertOk(result.response.ok && result.data?.data?.metrics?.fingerprint, `Quote fehlgeschlagen: ${result.response.status} ${result.text}`);
  return {
    fingerprint: result.data.data.metrics.fingerprint,
    date,
    netPrice: result.data.data.metrics.netPrice,
    areaDifficulty: result.data.data.metrics.areaDifficulty,
    areaDifficultyFactor: result.data.data.metrics.areaDifficultyFactor,
  };
}

function orderPayload({ suffix, segments, flyerQuantity, completionPath, quoteFingerprint, date }) {
  return {
    serviceType: "FLYER_DISTRIBUTION",
    city: segments[0].city,
    postalCode: segments[0].postalCode,
    targetAreaName: `Module 27.1 ${suffix}`,
    areaType: "POLYGON",
    targetAreaGeoJson: JSON.stringify(segments[0].geometryGeoJson),
    areaSegments: JSON.stringify(segments),
    coverageAreaSqm: segments.length * 640000,
    estimatedHouseholds: 2400,
    estimatedFlyers: flyerQuantity,
    centerLat: 50.3569,
    centerLng: 7.589,
    flyerQuantity,
    flyerSource: "CUSTOMER_OWN",
    printDataStatus: "UPLOAD_LATER",
    completionPath,
    preferredStartDate: date.start,
    preferredEndDate: date.end,
    flexibleScheduling: true,
    contactPerson: "Runtime-Pruefung",
    contactPhone: "+49 261 1000000",
    notes: "Technischer Laufzeittest fuer Modul 27.1.",
    quoteFingerprint,
  };
}

async function createOrder(cookie, payload) {
  const data = await jsonRequest("/api/customer/orders", "POST", payload, cookie);
  assertOk(data?.data?.id, "Auftrag wurde ohne ID angelegt.");
  return data.data;
}

async function runCoreFlow() {
  const rateLimitIds = ["kunde.immobilien@example.com", "admin@example.com"].map((email) => createHash("sha256")
    .update(`flyero-auth-rate-limit:login:account:${email}`)
    .digest("hex"));
  await prisma.authRateLimitBucket.deleteMany({ where: { id: { in: rateLimitIds } } });
  const customerCookie = await login("kunde.immobilien@example.com");
  const adminCookie = await login("admin@example.com");
  const multi = [
    segment("Koblenz Innenstadt", "Koblenz", "56068", 0),
    segment("Bendorf Zentrum", "Bendorf", "56170", 0.03),
  ];
  const tier10000 = await quote([multi[0]], 10000, "direct_payment");
  const tier10001 = await quote([multi[0]], 10001, "direct_payment");
  assert.equal(String(tier10000.netPrice), "3600", "10.000 Flyer muessen 3.600 EUR netto ergeben.");
  assert.equal(String(tier10001.netPrice), "3600.31", "10.001 Flyer muessen marginal 3.600,31 EUR netto ergeben.");
  const multiQuote = await quote(multi, 3000, "inquiry");
  assert.equal(String(multiQuote.netPrice), "1311", "Mehrgebietspreis muss die zentrale Staffel mit dem abgeleiteten Gebietsfaktor berechnen.");
  assert.equal(multiQuote.areaDifficulty, "MIXED", "Getrennte Teilgebiete muessen serverseitig als gemischte Zustellung bewertet werden.");
  assert.equal(String(multiQuote.areaDifficultyFactor), "1.15", "Der Gebietsfaktor muss im Mehrgebiet-Angebot transparent feststehen.");
  const inquiry = await createOrder(customerCookie, orderPayload({
    suffix: "Mehrgebiet",
    segments: multi,
    flyerQuantity: 3000,
    completionPath: "inquiry",
    quoteFingerprint: multiQuote.fingerprint,
    date: multiQuote.date,
  }));

  assert.equal(inquiry.status, "SUBMITTED", "Unverbindliche Anfrage muss SUBMITTED starten.");
  let stored = await prisma.order.findUnique({ where: { id: inquiry.id }, include: { distributionSegments: true, payments: true } });
  assert.equal(stored.distributionSegments.length, 2, "Mehrere Teilgebiete wurden nicht einzeln gespeichert.");
  assert.equal(stored.payments.length, 0, "Eine Anfrage darf keine Zahlung anlegen.");
  assert.equal(stored.calculatedNetPrice.toString(), "1311", "Mehrgebietspreis muss die zentrale Staffel plus Gebietsfaktor abbilden.");
  assert.equal(stored.calculatedVat.toString(), "249.09", "MwSt. muss serverseitig aus dem Mehrgebietspreis kommen.");
  assert.equal(stored.calculatedGrossPrice.toString(), "1560.09", "Brutto-Preis muss Netto plus MwSt. des Mehrgebiets sein.");
  assert.equal(stored.priceRuleSnapshot?.areaDifficulty, "MIXED", "Order-Snapshot muss den serverseitig abgeleiteten Gebietstyp speichern.");
  assert.equal(stored.priceRuleSnapshot?.areaDifficultyFactor, "1.15", "Order-Snapshot muss den angewendeten Gebietsfaktor speichern.");
  assertOk(stored.targetAreaGeoJson && stored.priceRuleSnapshot?.areaCalculationSnapshot, "Order-Snapshot fehlt.");

  const inquiryCheckout = await request(`/api/payments/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: customerCookie },
    body: JSON.stringify({ orderId: inquiry.id }),
  });
  assert.equal(inquiryCheckout.response.status, 409, "Eine unverbindliche Anfrage darf vor der Adminannahme keinen Checkout starten.");
  assert.equal(inquiryCheckout.data?.code, "PAYMENT_NOT_ALLOWED_BEFORE_REVIEW", "Checkout-Gate muss den fachlichen Grund zurueckgeben.");
  assert.equal(await prisma.payment.count({ where: { orderId: inquiry.id } }), 0, "Das Checkout-Gate darf keinen Payment-Datensatz anlegen.");

  const accepted = await jsonRequest(`/api/admin/orders/${inquiry.id}/review`, "POST", { action: "approve" }, adminCookie);
  assert.equal(accepted.data.status, "ACCEPTED_AWAITING_PAYMENT", "Annahme muss Zahlung ausstehend markieren.");
  stored = await prisma.order.findUnique({ where: { id: inquiry.id }, include: { payments: true } });
  assert.equal(stored.payments.length, 1, "Annahme muss genau einen Zahlungsdatensatz vorbereiten.");
  assert.equal(stored.payments[0].status, "CHECKOUT_CREATED", "Checkout muss nach Annahme vorbereitet sein.");
  assertOk(typeof stored.priceRuleSnapshot?.reviewDecisionSnapshot?.adminUserId === "string", "Annahme-Snapshot fehlt.");

  await jsonRequest(`/api/admin/orders/${inquiry.id}/review`, "POST", { action: "approve" }, adminCookie);
  const paymentCountBeforePayment = await prisma.payment.count({ where: { orderId: inquiry.id } });
  assert.equal(paymentCountBeforePayment, 1, "Wiederholte Annahme darf keinen zweiten Payment-Datensatz erzeugen.");

  const completed = await jsonRequest(`/api/payments/mock-complete/${stored.payments[0].id}`, "POST", {}, customerCookie);
  assertOk(completed.ok, "Mock-Checkout konnte im CI-Test nicht abgeschlossen werden.");
  stored = await prisma.order.findUnique({ where: { id: inquiry.id }, include: { payments: true, invoice: true, logisticsShipments: true } });
  assert.equal(stored.status, "APPROVED", "Zahlung nach angenommener Anfrage muss automatisch freigeben.");
  assert.equal(stored.payments.filter((item) => item.status === "PAID").length, 1, "Zahlung wurde nicht als bezahlt gespeichert.");
  assert.equal(stored.invoice ? 1 : 0, 1, "Freigabe muss genau eine Rechnung erzeugen.");
  assert.equal(stored.logisticsShipments.length, 1, "Eigene Flyer muessen den Lager-/Lieferpfad erzeugen.");

  await jsonRequest(`/api/admin/orders/${inquiry.id}/review`, "POST", { action: "approve" }, adminCookie);
  const repeated = await prisma.order.findUnique({ where: { id: inquiry.id }, include: { invoice: true, logisticsShipments: true } });
  assert.equal(repeated.logisticsShipments.length, 1, "Wiederholte Freigabe darf keine zweite Lieferung erzeugen.");
  assert.equal(repeated.invoice?.id, stored.invoice?.id, "Wiederholte Freigabe darf keine zweite Rechnung erzeugen.");

  const correctionResponse = await request(`/api/customer/orders/${inquiry.id}`, { method: "PUT", headers: { "content-type": "application/json", cookie: customerCookie }, body: "{}" });
  assert.equal(correctionResponse.response.status, 409, "Bezahlte Preis-/Gebietskorrektur muss serverseitig 409 liefern.");
  assert.equal(correctionResponse.data?.code, "PAID_ORDER_REQUIRES_ADMIN_CHANGE", "Korrekturfehler muss fachlich codiert sein.");

  const correctionSegments = [segment("Koblenz Nord", "Koblenz", "56070", 0.09)];
  const correctionQuote = await quote(correctionSegments, 3000, "inquiry");
  const correction = await createOrder(customerCookie, orderPayload({
    suffix: "Korrektur",
    segments: multi,
    flyerQuantity: 3000,
    completionPath: "inquiry",
    quoteFingerprint: multiQuote.fingerprint,
    date: multiQuote.date,
  }));
  await jsonRequest(`/api/admin/orders/${correction.id}/review`, "POST", { action: "clarification", customerMessage: "Bitte pruefe das Gebiet noch einmal." }, adminCookie);
  const correctionProvider = await prisma.paymentProvider.findFirst({ where: { code: "stripe" } });
  assertOk(correctionProvider, "Stripe-Provider fuer die Korrekturpruefung fehlt.");
  await prisma.payment.create({
    data: {
      orderId: correction.id,
      customerId: correction.customerId,
      tenantId: correction.tenantId,
      providerId: correctionProvider.id,
      status: "CHECKOUT_CREATED",
      amount: correction.calculatedGrossPrice,
      currency: "EUR",
      description: "Stale checkout fuer Korrekturpruefung",
      checkoutUrl: "https://checkout.invalid/runtime-correction",
    },
  });
  const corrected = await jsonRequest(`/api/customer/orders/${correction.id}`, "PUT", orderPayload({
    suffix: "Korrektur neu",
    segments: correctionSegments,
    flyerQuantity: 3000,
    completionPath: "inquiry",
    quoteFingerprint: correctionQuote.fingerprint,
    date: correctionQuote.date,
  }), customerCookie);
  assert.equal(corrected.data.status, "UNDER_REVIEW", "Kundenkorrektur muss erneut in die Adminpruefung gehen.");
  const correctionStored = await prisma.order.findUnique({ where: { id: correction.id }, include: { distributionSegments: true, payments: true } });
  assert.equal(correctionStored.distributionAreaId, null, "Alte DistributionArea-Relation darf bei der Korrektur nicht weiterleben.");
  assert.equal(correctionStored.distributionSegments.length, 1, "Kundenkorrektur muss alte Teilgebiete atomar ersetzen.");
  assert.equal(correctionStored.areaDifficulty, correctionQuote.areaDifficulty, "Kundenkorrektur muss den serverseitig abgeleiteten Gebietstyp am Auftrag aktualisieren.");
  assert.equal(correctionStored.calculatedNetPrice.toString(), String(correctionQuote.netPrice), "Kundenkorrektur muss den aktuellen serverseitigen Gebietspreis speichern.");
  assert.equal(correctionStored.priceRuleSnapshot?.areaDifficulty, correctionQuote.areaDifficulty, "Kundenkorrektur muss den serverseitig abgeleiteten Gebietstyp im Pricing-Snapshot speichern.");
  assert.equal(correctionStored.priceRuleSnapshot?.areaDifficultyFactor, correctionQuote.areaDifficultyFactor, "Kundenkorrektur muss den angewendeten Gebietsfaktor im Pricing-Snapshot speichern.");
  assert.equal(correctionStored.payments.filter((item) => ["CREATED", "CHECKOUT_CREATED", "PENDING"].includes(item.status)).length, 0, "Offene Zahlungen muessen bei der Korrektur invalidiert werden.");
  const correctionAccepted = await jsonRequest(`/api/admin/orders/${correction.id}/review`, "POST", { action: "approve" }, adminCookie);
  assert.equal(correctionAccepted.data.status, "ACCEPTED_AWAITING_PAYMENT", "Korrigierter Auftrag muss erneut angenommen werden koennen.");
  const changedPrice = await jsonRequest(`/api/admin/orders/${correction.id}/price`, "PATCH", { manualPriceOverride: 1300, note: "Runtime-Preispruefung" }, adminCookie);
  assert.equal(changedPrice.data.status, "UNDER_REVIEW", "Preisänderung muss eine neue Prüfung erzwingen.");
  const priceChangedOrder = await prisma.order.findUnique({ where: { id: correction.id }, include: { payments: true } });
  assert.equal(priceChangedOrder.payments.filter((item) => ["CREATED", "CHECKOUT_CREATED", "PENDING"].includes(item.status)).length, 0, "Preisänderung darf keinen alten Zahlungslink offen lassen.");

  const directSegments = [segment("Koblenz Sued", "Koblenz", "56068", 0.06)];
  const directQuote = await quote(directSegments, 3000, "direct_payment");
  const direct = await createOrder(customerCookie, orderPayload({
    suffix: "Direktzahlung",
    segments: directSegments,
    flyerQuantity: 3000,
    completionPath: "direct_payment",
    quoteFingerprint: directQuote.fingerprint,
    date: directQuote.date,
  }));
  const checkout = await jsonRequest("/api/payments/checkout", "POST", { orderId: direct.id }, customerCookie);
  assertOk(checkout.data?.checkoutUrl, "Direkter Checkout wurde nicht vorbereitet.");
  const directBefore = await prisma.order.findUnique({ where: { id: direct.id }, include: { payments: true } });
  const directPayment = directBefore.payments[0];
  await jsonRequest(`/api/payments/mock-complete/${directPayment.id}`, "POST", {}, customerCookie);
  const directAfter = await prisma.order.findUnique({ where: { id: direct.id }, include: { invoice: true } });
  assert.equal(directAfter.status, "PAID_WAITING_FOR_ADMIN_REVIEW", "Direktzahlung darf die Adminpruefung nicht ueberspringen.");
  assert.equal(directAfter.invoice, null, "Direktzahlung darf vor Adminfreigabe keine Rechnung erzeugen.");
  await jsonRequest(`/api/admin/orders/${direct.id}/review`, "POST", { action: "approve" }, adminCookie);
  const directApproved = await prisma.order.findUnique({ where: { id: direct.id }, include: { invoice: true } });
  assert.equal(directApproved.status, "APPROVED", "Direktzahlung muss erst nach Adminfreigabe operativ freigegeben werden.");
  assertOk(directApproved.invoice, "Direktzahlung muss nach Adminfreigabe eine Rechnung erzeugen.");
  await jsonRequest(`/api/admin/orders/${direct.id}/review`, "POST", { action: "reject", rejectionReason: "Runtime-Rueckabwicklung" }, adminCookie);
  const rejectedDirect = await prisma.order.findUnique({ where: { id: direct.id }, include: { payments: true } });
  const rejectedRefunds = await prisma.refund.findMany({ where: { orderId: direct.id } });
  assert.equal(rejectedDirect.status, "REJECTED", "Bezahlte Ablehnung muss den Auftrag fachlich ablehnen.");
  assert.equal(rejectedDirect.payments.filter((item) => item.status === "REFUNDED").length, 1, "Bezahlte Ablehnung muss die Zahlung vollständig erstatten.");
  const directCustomer = await prisma.customerProfile.findUnique({ where: { id: direct.customerId }, select: { userId: true } });
  const rejectionMessages = await prisma.notificationMessage.findMany({
    where: { userId: directCustomer.userId, type: "ORDER_REJECTED", data: { path: ["orderId"], equals: direct.id } },
  });
  assert.equal(rejectionMessages.length, 1, "Eine bezahlte Ablehnung muss genau eine Kundenbenachrichtigung erzeugen.");
  assert.ok(rejectionMessages[0].body.includes("Runtime-Rueckabwicklung"), "Der Ablehnungsgrund muss in der Kundenbenachrichtigung ankommen.");
  const refundCount = rejectedRefunds.length;
  await jsonRequest(`/api/admin/orders/${direct.id}/review`, "POST", { action: "reject", rejectionReason: "Runtime-Rueckabwicklung" }, adminCookie);
  const repeatedRejection = await prisma.refund.count({ where: { orderId: direct.id } });
  assert.equal(repeatedRejection, refundCount, "Wiederholte bezahlte Ablehnung darf keine zweite Erstattung erzeugen.");

  return { inquiryId: inquiry.id, directId: direct.id };
}

export async function runModule27Runtime() {
  const server = await ensureServer();
  try {
    const result = await runCoreFlow();
    console.log(`Module 27.1 runtime checks passed: inquiry=${result.inquiryId}, direct=${result.directId}`);
  } catch (error) {
    if (serverOutput) console.error(serverOutput);
    throw error;
  } finally {
    await prisma.$disconnect();
    if (server) server.kill();
  }
}
