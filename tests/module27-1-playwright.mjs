import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { chromium } from "playwright";

const baseUrl = process.env.MODULE27_1_BASE_URL || "http://localhost:3000";
const password = "DemoPasswort123!";
const orderMarker = `TEST-MODULE27-PLAYWRIGHT-${Date.now()}`;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let serverProcess = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server unter ${baseUrl} ist nicht erreichbar.`);
}

async function ensureServer() {
  try {
    const response = await fetch(`${baseUrl}/api/health`);
    if (response.ok) return;
  } catch {}
  const port = new URL(baseUrl).port || "3000";
  serverProcess = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port },
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  await waitForHealth();
}

async function resetSmokeAuthBuckets() {
  const values = [
    ["account", "kunde.immobilien@example.com"],
    ["account", "admin@example.com"],
    ["ip", "198.51.100.41"],
    ["ip", "198.51.100.42"],
    ["ip", "198.51.100.43"],
  ];
  const ids = values.map(([suffix, value]) => createHash("sha256")
    .update(`flyero-auth-rate-limit:login:${suffix}:${value}`)
    .digest("hex"));
  await prisma.authRateLimitBucket.deleteMany({ where: { id: { in: ids } } });
}

async function login(page, email, destination) {
  await page.goto(`${baseUrl}/login?next=${encodeURIComponent(destination)}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load").catch(() => undefined);
  await page.waitForTimeout(500);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click({ noWaitAfter: true });
  try {
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 });
  } catch (error) {
    // A cold Next dev compilation can submit the server-rendered form before hydration.
    // Retry through the same auth endpoint so the browser smoke remains deterministic.
    const response = await page.request.post(`${baseUrl}/api/auth/login`, { data: { email, password, next: destination } });
    assert(response.ok(), `Login fehlgeschlagen: ${response.status()}`);
    await page.goto(`${baseUrl}${destination}`, { waitUntil: "domcontentloaded" });
    if (page.url().endsWith("/login")) throw error;
  }
}

function smokeSegment() {
  return {
    name: orderMarker,
    city: "Koblenz",
    postalCode: "56068",
    district: "Testgebiet",
    country: "DE",
    geometryGeoJson: {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { source: "module27-1-playwright" },
        geometry: {
          type: "Polygon",
          coordinates: [[[7.58, 50.35], [7.59, 50.35], [7.59, 50.36], [7.58, 50.36], [7.58, 50.35]]],
        },
      }],
    },
  };
}

function dates() {
  const start = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

async function postFromPage(page, url, body) {
  return page.evaluate(async ({ requestUrl, requestBody }) => {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    return {
      ok: response.ok,
      status: response.status,
      body: await response.json().catch(() => null),
    };
  }, { requestUrl: url, requestBody: body });
}

async function createInquiry(page) {
  const segment = smokeSegment();
  const date = dates();
  const quoteParams = new URLSearchParams({
    city: segment.city,
    postalCode: segment.postalCode,
    flyerQuantity: "3000",
    coverageAreaSqm: "640000",
    flyerSource: "CUSTOMER_OWN",
    productFormat: "DIN Lang (99 × 210 mm)",
    printDataStatus: "UPLOAD_LATER",
    preferredStartDate: date.start,
    preferredEndDate: date.end,
    segments: JSON.stringify([segment]),
  });
  const quoteResponse = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return { ok: response.ok, status: response.status, body: await response.json().catch(() => null) };
  }, `${baseUrl}/api/maps/order-intelligence?${quoteParams.toString()}`);
  const quote = quoteResponse.body;
  assert(quoteResponse.ok && quote?.data?.metrics?.fingerprint, `Quote fehlt: ${quoteResponse.status} ${JSON.stringify(quote)}`);

  const payload = {
    serviceType: "FLYER_DISTRIBUTION",
    city: segment.city,
    postalCode: segment.postalCode,
    targetAreaName: segment.name,
    areaType: "POLYGON",
    targetAreaGeoJson: JSON.stringify(segment.geometryGeoJson),
    areaSegments: JSON.stringify([segment]),
    coverageAreaSqm: Number(quote.data.metrics.coverageAreaSqm),
    estimatedHouseholds: Number(quote.data.metrics.households),
    estimatedFlyers: 3000,
    estimatedDistanceMeters: Number(quote.data.metrics.routeDistanceMeters),
    areaCalculationSnapshot: JSON.stringify({ source: "module27-1-playwright", confidence: "low" }),
    centerLat: 50.355,
    centerLng: 7.585,
    flyerQuantity: 3000,
    flyerSource: "CUSTOMER_OWN",
    productFormat: "DIN Lang (99 × 210 mm)",
    printDataStatus: "UPLOAD_LATER",
    completionPath: "inquiry",
    preferredStartDate: date.start,
    preferredEndDate: date.end,
    flexibleScheduling: true,
    contactPerson: "Playwright Smoke",
    contactPhone: "+49 261 1000000",
    notes: "Automatischer Playwright-Runtime-Test.",
    quoteFingerprint: quote.data.metrics.fingerprint,
  };
  const orderResponse = await postFromPage(page, `${baseUrl}/api/customer/orders`, payload);
  const order = orderResponse.body;
  assert(orderResponse.ok && order?.data?.id, `Anfrage konnte nicht angelegt werden: ${orderResponse.status} expected=${quote.data.metrics.fingerprint} ${JSON.stringify(order)}`);
  return { id: order.data.id, orderNumber: order.data.orderNumber };
}

async function run() {
  await ensureServer();
  await resetSmokeAuthBuckets();
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const customerContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": "198.51.100.41" } });
  const customerPage = await customerContext.newPage();
  customerPage.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.text().includes("maps.googleapis.com/$rpc") || message.text().includes("No 'Access-Control-Allow-Origin' header") || message.text() === "Failed to load resource: net::ERR_FAILED" || (process.env.ENABLE_MOCK_PAYMENTS !== "true" && message.text().includes("server responded with a status of 404"))) return;
    errors.push(`customer console: ${message.text()}`);
  });
  customerPage.on("pageerror", (error) => errors.push(`customer pageerror: ${error.message}`));
  let samplingOrderId = null;

  try {
    await login(customerPage, "kunde.immobilien@example.com", "/customer/orders/new");
    await customerPage.goto(`${baseUrl}/customer/orders/new`, { waitUntil: "domcontentloaded" });
    await customerPage.locator('[data-testid="order-step-1"]').waitFor();
    await customerPage.locator('[data-testid="order-location-input"]').waitFor();
    await customerPage.locator('[data-testid="order-draw-area"]').click();

    const map = customerPage.locator('[data-testid="order-map"]');
    const mapReady = (await map.getAttribute("aria-hidden")) === "false";
    let drewPolygon = false;
    if (mapReady) {
      const box = await map.boundingBox();
      assert(box, "Google-Karte hat keine sichtbare Fläche.");
      const points = [
        [box.x + box.width * 0.34, box.y + box.height * 0.34],
        [box.x + box.width * 0.58, box.y + box.height * 0.34],
        [box.x + box.width * 0.62, box.y + box.height * 0.58],
        [box.x + box.width * 0.36, box.y + box.height * 0.60],
      ];
      for (const [x, y] of points) await customerPage.mouse.click(x, y);
      const finishDrawing = customerPage.locator('[data-testid="order-finish-drawing"]');
      await finishDrawing.waitFor({ timeout: 5000 });
      await finishDrawing.click();
      await customerPage.waitForTimeout(500);
      const rawSegments = await customerPage.locator('input[name="areaSegments"]').inputValue();
      drewPolygon = JSON.parse(rawSegments).length > 0;
      assert(drewPolygon, "Das gezeichnete Gebiet wurde nicht in die Planung übernommen.");
    } else {
      await customerPage.locator(".mapConfigNotice").waitFor({ timeout: 5000 });
      assert(process.env.REQUIRE_LIVE_MAPS !== "true", "REQUIRE_LIVE_MAPS=true, aber die Google-Karte ist nicht geladen.");
    }

    await customerPage.locator('[data-testid="order-step-2"]').click();
    const quantity = customerPage.locator('[data-testid="order-flyer-quantity"]');
    await quantity.fill("3000");
    await quantity.dispatchEvent("input");
    await quantity.dispatchEvent("change");
    await customerPage.locator('[data-testid="order-step-5"]').click();
    await customerPage.locator('[data-testid="order-price-net"]').waitFor();
    const visiblePrice = await customerPage.locator('[data-testid="order-price-net"]').innerText();
    assert(!visiblePrice.includes("wird berechnet"), "Der Preis bleibt in der Browserplanung unberechnet.");
    await customerPage.locator('[data-testid="order-step-6"]').click();
    await customerPage.locator('[data-testid="order-finish-inquiry"]').waitFor();

    // Product samples must always go through manual review and must never
    // expose direct payment in the real customer wizard.
    await customerPage.locator('[data-testid="order-step-2"]').click();
    await customerPage.getByRole("button", { name: /Sampling/ }).click();
    const samplingDetails = customerPage.locator('[data-testid="sampling-details"]');
    await samplingDetails.waitFor();
    const samplingInputs = samplingDetails.locator("input:not([type=checkbox])");
    await samplingInputs.nth(0).fill("10 ml");
    await samplingInputs.nth(1).fill("Beutel");
    await samplingInputs.nth(2).fill("trocken lagern");
    const warehouseSelect = customerPage.locator('[data-testid="order-warehouse-select"]');
    if (await warehouseSelect.count()) {
      await warehouseSelect.waitFor({ state: "attached" });
      const warehouseOptions = warehouseSelect.locator("option");
      if (await warehouseOptions.count() > 1) await warehouseSelect.selectOption({ index: 1 });
    }
    await customerPage.waitForTimeout(1800);
    await customerPage.locator('[data-testid="order-step-6"]').click();
    assert((await customerPage.locator('[data-testid="order-finish-direct"]').count()) === 0, "Sampling darf keinen Direktzahlungsbutton anzeigen.");
    const samplingInquiryButton = customerPage.locator('[data-testid="order-finish-inquiry"]');
    await samplingInquiryButton.waitFor();
    assert((await samplingInquiryButton.innerText()).includes("Sampling"), "Sampling muss als individuelles Angebot angefragt werden.");
    await samplingInquiryButton.click();
    await customerPage.waitForURL(/\/customer\/orders\/[^/?]+/, { timeout: 15000 });
    samplingOrderId = new URL(customerPage.url()).pathname.split("/").filter(Boolean).pop();
    assert(samplingOrderId, "Die Sampling-Anfrage wurde nicht mit einem Auftrag verknüpft.");
    assert((await customerPage.locator("body").innerText()).includes("Kampagne"), "Die Sampling-Anfrage führt nicht zur Auftragsbestätigung.");

    const manipulatedSegment = {
      name: "Playwright-Prüfgebiet",
      city: "Unbekannter Ort",
      postalCode: "99999",
      geometryGeoJson: {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [[[7.5, 50.3], [7.52, 50.3], [7.52, 50.31], [7.5, 50.31], [7.5, 50.3]]] },
        }],
      },
    };
    const manipulatedParams = new URLSearchParams({
      city: manipulatedSegment.city,
      postalCode: manipulatedSegment.postalCode,
      flyerQuantity: "3000",
      flyerSource: "CUSTOMER_OWN",
      productFormat: "DIN Lang (99 × 210 mm)",
      printDataStatus: "UPLOAD_LATER",
      areaDifficulty: "NORMAL",
      segments: JSON.stringify([manipulatedSegment]),
    });
    const manipulatedResponse = await customerPage.request.get(`${baseUrl}/api/maps/order-intelligence?${manipulatedParams.toString()}`);
    const manipulatedBody = await manipulatedResponse.json();
    assert(manipulatedResponse.ok(), `Serverprüfung des manipulierten Gebiets fehlgeschlagen: ${manipulatedResponse.status()}`);
    assert(manipulatedBody?.data?.metrics?.areaDifficulty !== "NORMAL", "Der manipulierte NORMAL-Hinweis darf nicht als serverseitige Gebietsart zurückkommen.");

    const inquiry = await createInquiry(customerPage);
    const customerOrderPage = await customerContext.newPage();
    await customerOrderPage.goto(`${baseUrl}/customer/orders/${inquiry.id}?inquiry=success`, { waitUntil: "domcontentloaded" });
    const customerOrderText = await customerOrderPage.locator("body").innerText();
    assert(customerOrderText.includes("Kampagne") && customerOrderText.includes("Verteilgebiet"), "Kunde sieht den angelegten Auftrag nicht.");

    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": "198.51.100.42" } });
    const adminPage = await adminContext.newPage();
    await login(adminPage, "admin@example.com", `/admin/orders/${inquiry.id}`);
    await adminPage.goto(`${baseUrl}/admin/orders/${inquiry.id}`, { waitUntil: "domcontentloaded" });
    assert((await adminPage.locator("body").innerText()).includes(inquiry.orderNumber), "Admin sieht den Auftrag nicht.");

    const approval = await postFromPage(adminPage, `${baseUrl}/api/admin/orders/${inquiry.id}/review`, { action: "approve" });
    const approvalBody = approval.body;
    assert(approval.ok && approvalBody?.data?.status === "ACCEPTED_AWAITING_PAYMENT", `Admin-Annahme wurde nicht gespeichert: ${approval.status} ${JSON.stringify(approvalBody)}`);
    const payment = await prisma.payment.findFirst({ where: { orderId: inquiry.id }, orderBy: { createdAt: "desc" } });
    assert(payment, "Nach der Annahme fehlt die Zahlungsaufforderung.");
    const completed = await postFromPage(customerPage, `${baseUrl}/api/payments/mock-complete/${payment.id}`, {});
    if (process.env.ENABLE_MOCK_PAYMENTS === "true") {
      assert(completed.ok, `Testzahlung fehlgeschlagen: ${completed.status}`);
      assert(completed.body?.ok === true, "Testzahlung liefert keinen erfolgreichen Status.");
    } else {
      assert(!completed.ok, "Testzahlungen müssen außerhalb des ausdrücklich aktivierten Testmodus blockiert bleiben.");
    }
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    assert((await adminPage.locator("body").innerText()).includes("Zahlung"), "Adminseite zeigt keinen Zahlungsbereich.");

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "x-forwarded-for": "198.51.100.43" } });
    const mobilePage = await mobileContext.newPage();
    await login(mobilePage, "kunde.immobilien@example.com", "/customer/orders/new");
    await mobilePage.goto(`${baseUrl}/customer/orders/new`, { waitUntil: "domcontentloaded" });
    const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert(!overflow, "Bestellflow erzeugt auf Mobil eine horizontale Überbreite.");
    await mobileContext.close();
    await adminContext.close();

    assert(errors.length === 0, errors.join("\n"));
    console.log(`Module 27.1 Playwright smoke passed: order=${inquiry.orderNumber}, map=${drewPolygon ? "drawn" : "fallback-observed"}`);
  } finally {
    await customerContext.close();
    await browser.close();
    const testOrders = await prisma.order.findMany({ where: { targetAreaName: orderMarker }, select: { id: true } });
    for (const testOrder of testOrders) {
      await prisma.invoice.deleteMany({ where: { orderId: testOrder.id } });
      await prisma.order.delete({ where: { id: testOrder.id } });
    }
    if (samplingOrderId) {
      await prisma.invoice.deleteMany({ where: { orderId: samplingOrderId } });
      await prisma.order.delete({ where: { id: samplingOrderId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
    if (serverProcess) serverProcess.kill();
  }
}

await run();
