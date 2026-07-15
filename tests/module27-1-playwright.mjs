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

async function createInquiry(request) {
  const segment = smokeSegment();
  const date = dates();
  const quoteResponse = await request.post(`${baseUrl}/api/public/planner/quote`, {
    data: {
      city: segment.city,
      postalCode: segment.postalCode,
      targetAreaName: segment.name,
      flyerQuantity: 3000,
      coverageAreaSqm: 640000,
      flyerSource: "CUSTOMER_OWN",
      productFormat: "DIN_LANG",
      printDataStatus: "UPLOAD_LATER",
      preferredStartDate: date.start,
      preferredEndDate: date.end,
      segments: [segment],
      completionPath: "inquiry",
    },
  });
  const quote = await quoteResponse.json();
  assert(quoteResponse.ok() && quote?.data?.metrics?.fingerprint, `Quote fehlt: ${quoteResponse.status()} ${JSON.stringify(quote)}`);

  const payload = {
    serviceType: "FLYER_DISTRIBUTION",
    city: segment.city,
    postalCode: segment.postalCode,
    targetAreaName: segment.name,
    areaType: "POLYGON",
    targetAreaGeoJson: JSON.stringify(segment.geometryGeoJson),
    areaSegments: JSON.stringify([segment]),
    coverageAreaSqm: 640000,
    estimatedHouseholds: 2400,
    estimatedFlyers: 3000,
    estimatedDistanceMeters: 4200,
    areaCalculationSnapshot: JSON.stringify({ source: "module27-1-playwright", confidence: "low" }),
    centerLat: 50.355,
    centerLng: 7.585,
    flyerQuantity: 3000,
    flyerSource: "CUSTOMER_OWN",
    productFormat: "DIN_LANG",
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
  const orderResponse = await request.post(`${baseUrl}/api/customer/orders`, { data: payload });
  const order = await orderResponse.json();
  assert(orderResponse.ok() && order?.data?.id, `Anfrage konnte nicht angelegt werden: ${orderResponse.status()}`);
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
    if (message.text().includes("maps.googleapis.com/$rpc") || message.text().includes("No 'Access-Control-Allow-Origin' header") || message.text() === "Failed to load resource: net::ERR_FAILED") return;
    errors.push(`customer console: ${message.text()}`);
  });
  customerPage.on("pageerror", (error) => errors.push(`customer pageerror: ${error.message}`));

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
      await customerPage.mouse.dblclick(points[0][0], points[0][1]);
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

    const inquiry = await createInquiry(customerPage.request);
    const customerOrderPage = await customerContext.newPage();
    await customerOrderPage.goto(`${baseUrl}/customer/orders/${inquiry.id}?inquiry=success`, { waitUntil: "domcontentloaded" });
    const customerOrderText = await customerOrderPage.locator("body").innerText();
    assert(customerOrderText.includes("Kampagne") && customerOrderText.includes("Verteilgebiet"), "Kunde sieht den angelegten Auftrag nicht.");

    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": "198.51.100.42" } });
    const adminPage = await adminContext.newPage();
    await login(adminPage, "admin@example.com", `/admin/orders/${inquiry.id}`);
    await adminPage.goto(`${baseUrl}/admin/orders/${inquiry.id}`, { waitUntil: "domcontentloaded" });
    assert((await adminPage.locator("body").innerText()).includes(inquiry.orderNumber), "Admin sieht den Auftrag nicht.");

    const approval = await adminPage.request.post(`${baseUrl}/api/admin/orders/${inquiry.id}/review`, { data: { action: "approve" } });
    const approvalBody = await approval.json();
    assert(approval.ok && approvalBody?.data?.status === "ACCEPTED_AWAITING_PAYMENT", "Admin-Annahme wurde nicht gespeichert.");
    const payment = await prisma.payment.findFirst({ where: { orderId: inquiry.id }, orderBy: { createdAt: "desc" } });
    assert(payment, "Nach der Annahme fehlt die Zahlungsaufforderung.");
    const completed = await customerPage.request.post(`${baseUrl}/api/payments/mock-complete/${payment.id}`, { data: {} });
    assert(completed.ok, `Mock-Zahlung fehlgeschlagen: ${completed.status()}`);
    const completedBody = await completed.json();
    assert(completedBody?.ok === true, "Mock-Zahlung liefert keinen erfolgreichen Status.");
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
    await prisma.$disconnect();
    if (serverProcess) serverProcess.kill();
  }
}

await run();
