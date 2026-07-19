import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { chromium } from "playwright";

const baseUrl = process.env.CUSTOMER_ORDER_NEW_PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const outDir = join(process.cwd(), ".tmp", "customer-order-new-playwright");
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

await mkdir(outDir, { recursive: true });
await ensureServer();
await prisma.authRateLimitBucket.deleteMany({ where: { id: { in: bucketIds } } });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  extraHTTPHeaders: { "x-forwarded-for": testIp },
});
const page = await context.newPage();
const browserErrors = [];
const failedRequests = [];
page.on("console", (message) => {
  if (message.type() === "error"
    && !message.text().includes("maps.googleapis.com/$rpc")
    && !message.text().includes("maps.googleapis.com/maps/api/mapsjs/gen_204")
    && !message.text().includes("Failed to load resource: net::ERR_FAILED")) {
    browserErrors.push(message.text());
  }
});
page.on("pageerror", (error) => browserErrors.push(error.message));
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
  if (desktopMetrics.mapReady) {
    await page.locator('[data-testid="order-draw-area"]').click();
    const mapBox = await page.locator('[data-testid="order-map"]').boundingBox();
    assert(mapBox, "Die Kartenfläche muss für die Gebietsauswahl sichtbar sein.");
    // The overview panel intentionally sits above the right side of the map;
    // use the unobstructed map area so this tests the real drawing interaction.
    for (const [x, y] of [[0.2, 0.2], [0.3, 0.2], [0.3, 0.4]]) {
      await page.mouse.click(mapBox.x + mapBox.width * x, mapBox.y + mapBox.height * y);
      await page.waitForTimeout(700);
    }
    const finishDrawing = page.locator('[data-testid="order-finish-drawing"]');
    if (!(await finishDrawing.isVisible().catch(() => false))) {
      const notice = await page.locator('.mapNotice').textContent().catch(() => "");
      throw new Error(`Der Zeichenweg hat nach drei Kartenklicks keinen Abschluss angeboten. Kartenhinweis: ${notice}`);
    }
  }
  for (const forbidden of ["Beispielhafter Ablauf", "keine echte Kampagne", "Fallback", "Quote", "Fingerprint", "Wartet intern"]) {
    assert(!desktopMetrics.bodyText.includes(forbidden), `Der Kunden-Wizard zeigt verbotenen Begriff: ${forbidden}`);
  }
  await page.screenshot({ path: join(outDir, "customer-order-new-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const mobileMetrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    hasMap: Boolean(document.querySelector('[data-testid="order-map"]')),
    hasDrawAction: Boolean(document.querySelector('[data-testid="order-draw-area"]')),
  }));
  assert.equal(mobileMetrics.scrollWidth, mobileMetrics.clientWidth, "Der Mobile-Wizard erzeugt horizontalen Überlauf.");
  assert(mobileMetrics.hasMap, "Die Kartenfläche fehlt mobil.");
  assert(mobileMetrics.hasDrawAction, "Der Zeichenweg fehlt mobil.");
  await page.screenshot({ path: join(outDir, "customer-order-new-mobile.png"), fullPage: true });

  const unexpectedFailedRequests = failedRequests.filter(({ url, error }) => {
    const isGoogleMaps = url.includes("maps.googleapis.com") || url.includes("maps.gstatic.com");
    const isLocalDevAbort = baseUrl.startsWith("http://localhost") && url.includes("/_next/") && error === "net::ERR_ABORTED";
    const isCancelledExperience = url.endsWith("/api/public/planner/experience") && error === "net::ERR_ABORTED";
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
