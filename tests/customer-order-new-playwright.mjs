import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { chromium } from "playwright";

const baseUrl = process.env.CUSTOMER_ORDER_NEW_PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const outDir = join(process.cwd(), ".tmp", "customer-order-new");
const desktopDir = join(outDir, "desktop");
const mobileDir = join(outDir, "mobile");
const email = "kunde.immobilien@example.com";
const password = "DemoPasswort123!";
const testIp = `198.51.100.${(Date.now() % 150) + 70}`;
const bucketIds = ["ip", "account"].map((scope) => createHash("sha256")
  .update(`flyero-auth-rate-limit:login:${scope}:${scope === "ip" ? testIp : email}`)
  .digest("hex"));
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let server = null;

async function waitForHealth() {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server unter ${baseUrl} ist nicht erreichbar.`);
}

async function ensureServer() {
  try {
    if ((await fetch(`${baseUrl}/api/health`)).ok) return;
  } catch {}
  const port = new URL(baseUrl).port || "3000";
  server = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port },
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  await waitForHealth();
}

async function login(page) {
  await page.goto(`${baseUrl}/login?next=/customer/orders/new`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click({ noWaitAfter: true });
  try {
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 });
  } catch (error) {
    const response = await page.request.post(`${baseUrl}/api/auth/login`, {
      data: { email, password, next: "/customer/orders/new" },
      headers: { "x-forwarded-for": testIp },
    });
    assert(response.ok(), `Kundenlogin fehlgeschlagen: ${response.status()}`);
    await page.goto(`${baseUrl}/customer/orders/new`, { waitUntil: "domcontentloaded" });
    if (new URL(page.url()).pathname.endsWith("/login")) throw error;
  }
}

await mkdir(desktopDir, { recursive: true });
await mkdir(mobileDir, { recursive: true });
await ensureServer();
await prisma.authRateLimitBucket.deleteMany({ where: { id: { in: bucketIds } } });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  serviceWorkers: "block",
  extraHTTPHeaders: { "x-forwarded-for": testIp },
});
const page = await context.newPage();
const browserErrors = [];
const failedRequests = [];
const rateLimitResponses = [];
const isExpectedLocalMapsConfigurationMessage = (text) => baseUrl.startsWith("http://localhost") && [
  "maps.googleapis.com/maps/api/mapsjs/mapConfigs:batchGet",
  "Unable to fetch configuration for mapId",
  "The map is initialized without a valid map ID",
  "The Map Style does not have the following FeatureLayer configured",
].some((fragment) => text.includes(fragment));
page.on("console", (message) => {
  if (message.type() === "error"
    && !message.text().includes("maps.googleapis.com/$rpc")
    && !message.text().includes("maps.googleapis.com/maps/api/mapsjs/gen_204")
    && !isExpectedLocalMapsConfigurationMessage(message.text())
    && !message.text().includes("Failed to load resource: net::ERR_FAILED")) {
    browserErrors.push(message.text());
  }
});
page.on("pageerror", (error) => browserErrors.push(error.message));
page.on("response", (response) => {
  if (response.status() === 429 && response.url().includes("/api/maps/")) rateLimitResponses.push(response.url());
});
page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? "unknown" }));

try {
  await login(page);
  assert.equal(new URL(page.url()).pathname, "/customer/orders/new", "Der Kunden-Wizard muss nach dem Login direkt geöffnet werden.");
  await page.waitForSelector('[data-testid="order-location-input"]');
  if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY) {
    await page.waitForFunction(
      () => document.querySelector('[data-testid="order-map"]')?.getAttribute("aria-hidden") === "false",
      null,
      { timeout: 12000 },
    );
    await page.waitForSelector('[data-testid="order-map"] .gm-style', { state: "attached", timeout: 15000 });
    await page.waitForTimeout(2000);
  } else {
    await page.waitForTimeout(1000);
  }

  const desktopMetrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyText: document.body.innerText,
    hasMap: Boolean(document.querySelector('[data-testid="order-map"]')),
    mapReady: document.querySelector('[data-testid="order-map"]')?.getAttribute("aria-hidden") === "false",
    hasDrawAction: Boolean(document.querySelector('[data-testid="order-draw-area"]')),
    hasDisabledBoundaryAction: Boolean(document.querySelector('[data-testid="order-select-boundary"][disabled]')),
  }));
  assert.equal(desktopMetrics.scrollWidth, desktopMetrics.clientWidth, "Der Desktop-Wizard erzeugt horizontalen Überlauf.");
  assert(desktopMetrics.hasMap, "Die Kartenfläche fehlt im Kunden-Wizard.");
  if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY) {
    assert(desktopMetrics.mapReady, "Die Google-Karte bleibt trotz gesetztem Browser-Key im Ladezustand.");
  }
  assert(desktopMetrics.hasDrawAction, "Der funktionierende Zeichenweg fehlt.");
  assert(!desktopMetrics.hasDisabledBoundaryAction, "Eine nicht verfügbare Grenzschaltfläche darf nicht als deaktivierter Hauptweg erscheinen.");
  await page.screenshot({ path: join(desktopDir, "start.png"), fullPage: true });
  const locationInput = page.locator('[data-testid="order-location-input"]');
  await locationInput.fill("56068");
  await page.waitForTimeout(900);
  const suggestion = page.locator(".orderSuggestions button").first();
  assert((await suggestion.count()) > 0, "Die PLZ-Suche zeigt keinen auswählbaren Ortsvorschlag.");
  await suggestion.click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: join(desktopDir, "location-selected.png"), fullPage: true });
  assert((await locationInput.inputValue()).includes("56068"), "Die ausgewählte PLZ bleibt nicht im Kundenwizard sichtbar.");
  assert.equal(rateLimitResponses.length, 0, `Die normale PLZ-Auswahl löste 429 aus: ${rateLimitResponses.join(", ")}`);
  if (desktopMetrics.mapReady) {
    await page.locator('[data-testid="order-draw-area"]').click();
    const mapBox = await page.locator('[data-testid="order-map"]').boundingBox();
    assert(mapBox, "Die Kartenfläche muss für die Gebietsauswahl sichtbar sein.");
    // The overview panel intentionally sits above the right side of the map;
    // use the unobstructed map area so this tests the real drawing interaction.
    for (const [x, y] of [[0.08, 0.32], [0.16, 0.68], [0.32, 0.68], [0.2, 0.48], [0.1, 0.58]]) {
      await page.mouse.click(mapBox.x + mapBox.width * x, mapBox.y + mapBox.height * y);
      await page.waitForTimeout(700);
      if (await page.locator('[data-testid="order-finish-drawing"]').isVisible().catch(() => false)) break;
    }
    const finishDrawing = page.locator('[data-testid="order-finish-drawing"]');
    if (!(await finishDrawing.isVisible().catch(() => false))) {
      const notice = await page.locator('.mapNotice').textContent().catch(() => "");
      throw new Error(`Der Zeichenweg hat nach drei Kartenklicks keinen Abschluss angeboten. Kartenhinweis: ${notice}`);
    }
    await finishDrawing.click();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: join(desktopDir, "area-drawn.png"), fullPage: true });
    await page.screenshot({ path: join(desktopDir, "price-ready.png"), fullPage: true });
    const priceStatus = await page.locator(".orderPriceFooter strong").textContent();
    assert(priceStatus && !["Gebiet auswÃ¤hlen", "Preis wird aktualisiert"].includes(priceStatus.trim()), `Nach dem Zeichnen wurde kein nutzbarer Preisstatus angezeigt: ${priceStatus}`);
  }
  for (const forbidden of ["Beispielhafter Ablauf", "keine echte Kampagne", "Fallback", "Quote", "Fingerprint", "Wartet intern"]) {
    assert(!desktopMetrics.bodyText.includes(forbidden), `Der Kunden-Wizard zeigt verbotenen Begriff: ${forbidden}`);
  }
  await page.locator('[data-testid="order-step-5"]').click();
  await page.locator('[data-testid="order-price-net"]').waitFor();
  await page.screenshot({ path: join(desktopDir, "summary.png"), fullPage: true });
  await page.locator('[data-testid="order-step-2"]').click();
  await page.getByRole("button", { name: /Sampling/ }).click();
  await page.locator('[data-testid="sampling-details"]').waitFor();
  await page.screenshot({ path: join(desktopDir, "sampling.png"), fullPage: true });
  await page.locator('[data-testid="order-step-6"]').click();
  await page.locator('[data-testid="order-finish-inquiry"]').waitFor();
  await page.screenshot({ path: join(desktopDir, "manual-review.png"), fullPage: true });
  await page.locator('[data-testid="order-step-1"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(desktopDir, "customer-order-new.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const mobileMetrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    hasMap: Boolean(document.querySelector('[data-testid="order-map"]')),
    hasDrawAction: Boolean(document.querySelector('[data-testid="order-draw-area"]')),
    mapStageWidth: document.querySelector('.orderMapStage')?.getBoundingClientRect().width ?? 0,
    viewportWidth: window.innerWidth,
  }));
  assert.equal(mobileMetrics.scrollWidth, mobileMetrics.clientWidth, "Der Mobile-Wizard erzeugt horizontalen Überlauf.");
  assert(mobileMetrics.hasMap, "Die Kartenfläche fehlt mobil.");
  assert(mobileMetrics.hasDrawAction, "Der Zeichenweg fehlt mobil.");
  assert(mobileMetrics.mapStageWidth >= mobileMetrics.viewportWidth - 2, "Die Kartenfläche darf mobil nicht auf eine schmale Desktop-Spalte schrumpfen.");
  const mobileMapLabel = await page.locator(".mapChromeTop span").boundingBox();
  const mobileMapTabs = await page.locator(".mapTabs").boundingBox();
  const mobileMapNotice = await page.locator(".mapNotice").boundingBox();
  const mobileMapZoomRail = await page.locator(".mapZoomRail").boundingBox();
  if (mobileMapLabel && mobileMapTabs) {
    const separatedHorizontally = mobileMapLabel.x + mobileMapLabel.width + 6 <= mobileMapTabs.x;
    const separatedVertically = mobileMapLabel.y + mobileMapLabel.height + 6 <= mobileMapTabs.y
      || mobileMapTabs.y + mobileMapTabs.height + 6 <= mobileMapLabel.y;
    assert(separatedHorizontally || separatedVertically, "Ortsbezeichnung und Kartenumschaltung überlappen mobil.");
  }
  if (mobileMapNotice && mobileMapZoomRail) {
    const separatedFromZoomRail = mobileMapNotice.x + mobileMapNotice.width + 6 <= mobileMapZoomRail.x
      || mobileMapZoomRail.x + mobileMapZoomRail.width + 6 <= mobileMapNotice.x
      || mobileMapNotice.y + mobileMapNotice.height + 6 <= mobileMapZoomRail.y
      || mobileMapZoomRail.y + mobileMapZoomRail.height + 6 <= mobileMapNotice.y;
    assert(separatedFromZoomRail, "Der Kartenhinweis darf mobil nicht unter der Zoom-Leiste liegen.");
  }
  await page.screenshot({ path: join(mobileDir, "customer-order-new.png"), fullPage: true });

  const unexpectedFailedRequests = failedRequests.filter(({ url, error }) => {
    const isGoogleMaps = url.includes("maps.googleapis.com") || url.includes("maps.gstatic.com");
    const isLocalDevAbort = baseUrl.startsWith("http://localhost") && url.includes("/_next/") && error === "net::ERR_ABORTED";
    const isCancelledExperience = (url.endsWith("/api/public/planner/experience")
      || url.includes("/api/maps/official-boundaries?")) && error === "net::ERR_ABORTED";
    return !isGoogleMaps && !isLocalDevAbort && !isCancelledExperience;
  });
  assert.deepEqual(browserErrors, [], `Kunden-Wizard meldet Browserfehler:\n${browserErrors.join("\n")}`);
  assert.deepEqual(unexpectedFailedRequests, [], `Kunden-Wizard hat Ressourcenfehler:\n${JSON.stringify(unexpectedFailedRequests, null, 2)}`);
  console.log(`Customer order new Playwright checks passed. Screenshots: ${outDir}`);
} finally {
  await context.close();
  await browser.close();
  await prisma.authRateLimitBucket.deleteMany({ where: { id: { in: bucketIds } } });
  await prisma.$disconnect();
  if (server) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    else server.kill();
  }
}
