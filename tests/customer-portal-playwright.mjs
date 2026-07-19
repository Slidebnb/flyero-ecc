import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { chromium } from "playwright";

const baseUrl = process.env.CUSTOMER_PORTAL_PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const outDir = join(process.cwd(), ".tmp", "customer-portal-playwright");
const password = "DemoPasswort123!";
const testIp = `198.51.100.${(Date.now() % 200) + 30}`;
const authBucketIds = ["ip", "account"].map((suffix) => createHash("sha256")
  .update(`flyero-auth-rate-limit:login:${suffix}:${suffix === "ip" ? testIp : "kunde.immobilien@example.com"}`)
  .digest("hex"));
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let server = null;

function assertNoVisibleTechnicalText(bodyText, path) {
  for (const forbidden of [
    "Seed Modul",
    "Module 22",
    "Module 23",
    "Smoke-Test",
    "EXTERNAL_GPS_REPORT",
    "OrderStatus",
    "ReportStatus",
    "proofMapCanvas",
    "proofRouteLine",
    "proofPin",
  ]) {
    assert(!bodyText.includes(forbidden), `${path} zeigt internen Text: ${forbidden}`);
  }
}

async function waitForHealth(url) {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server unter ${url} ist nicht erreichbar.`);
}

async function ensureServer() {
  try {
    const response = await fetch(`${baseUrl}/api/health`);
    if (response.ok) return;
  } catch {}
  const port = new URL(baseUrl).port || "3000";
  server = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port },
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  await waitForHealth(baseUrl);
}

async function login(page) {
  await page.goto(`${baseUrl}/login?next=/customer/dashboard`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill("kunde.immobilien@example.com");
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click({ noWaitAfter: true });
  try {
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 });
  } catch (error) {
    const response = await page.request.post(`${baseUrl}/api/auth/login`, {
      data: { email: "kunde.immobilien@example.com", password, next: "/customer/dashboard" },
      headers: { "x-forwarded-for": testIp },
    });
    assert(response.ok(), `Kundenlogin fehlgeschlagen: ${response.status()}`);
    await page.goto(`${baseUrl}/customer/dashboard`, { waitUntil: "domcontentloaded" });
    if (new URL(page.url()).pathname.endsWith("/login")) throw error;
  }
}

await mkdir(outDir, { recursive: true });
await ensureServer();
await prisma.authRateLimitBucket.deleteMany({ where: { id: { in: authBucketIds } } });

const routes = [
  ["dashboard", "/customer/dashboard"],
  ["orders", "/customer/orders"],
  ["orders-new", "/customer/orders/new"],
  ["reports", "/customer/reports"],
  ["documents", "/customer/documents"],
  ["invoices", "/customer/invoices"],
  ["payments", "/customer/payments"],
  ["notifications", "/customer/notifications"],
  ["support", "/customer/support"],
  ["profile", "/customer/profile"],
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  extraHTTPHeaders: { "x-forwarded-for": testIp },
});
const page = await context.newPage();
const errors = [];
const failedRequests = [];
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("maps.googleapis.com/$rpc") && !message.text().includes("Failed to load resource: net::ERR_FAILED")) errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));
page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? "unknown" }));

try {
  await login(page);
  for (const [name, path] of routes) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);
    assert.equal(new URL(page.url()).pathname, path, `${path} leitet unerwartet weiter.`);
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyText: document.body.innerText,
      overlay: [...document.querySelectorAll("[data-nextjs-dialog-overlay], nextjs-portal")].some((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0 || (element.textContent || "").trim().length > 0;
      }),
      dashboardOverlap: [...document.querySelectorAll(".customerCommandHero, .customerMissionGrid")].some((container) => {
        const children = [...container.children].map((child) => child.getBoundingClientRect());
        return children.some((left, index) => children.slice(index + 1).some((right) =>
          left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top
        ));
      }),
    }));
    assert.equal(metrics.scrollWidth, metrics.clientWidth, `${path} erzeugt horizontale Überbreite.`);
    assert(!metrics.overlay, `${path} zeigt ein Framework-Fehler-Overlay.`);
    assert(!metrics.dashboardOverlap, `${path} zeigt überlappende Dashboard-Bereiche.`);
    assertNoVisibleTechnicalText(metrics.bodyText, path);
    await page.screenshot({ path: join(outDir, `${name}-desktop.png`), fullPage: true });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, path] of routes.slice(0, 6)) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyText: document.body.innerText,
      dashboardOverlap: [...document.querySelectorAll(".customerCommandHero, .customerMissionGrid")].some((container) => {
        const children = [...container.children].map((child) => child.getBoundingClientRect());
        return children.some((left, index) => children.slice(index + 1).some((right) =>
          left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top
        ));
      }),
    }));
    assert.equal(metrics.scrollWidth, metrics.clientWidth, `${path} erzeugt mobil horizontale Überbreite.`);
    assert(!metrics.dashboardOverlap, `${path} zeigt mobil überlappende Dashboard-Bereiche.`);
    assertNoVisibleTechnicalText(metrics.bodyText, path);
    await page.screenshot({ path: join(outDir, `${name}-mobile.png`), fullPage: true });
  }

  const unexpectedFailedRequests = failedRequests.filter(({ url, error }) => {
    const isGoogleMapsRequest = url.includes("maps.googleapis.com") || url.includes("maps.gstatic.com");
    const isLocalDevHmrAbort = baseUrl.startsWith("http://localhost")
      && url.startsWith(`${baseUrl}/_next/static/chunks/`)
      && error === "net::ERR_ABORTED";
    return !isGoogleMapsRequest && !isLocalDevHmrAbort;
  });
  assert.equal(errors.length, 0, `Kundenportal meldet Browserfehler:\n${errors.join("\n")}`);
  assert.deepEqual(unexpectedFailedRequests, [], `Kundenportal hat Ressourcenfehler:\n${JSON.stringify(unexpectedFailedRequests, null, 2)}`);
  console.log(`Customer portal Playwright checks passed: ${routes.length} desktop routes, ${routes.slice(0, 6).length} mobile routes.`);
} finally {
  await context.close();
  await browser.close();
  await prisma.authRateLimitBucket.deleteMany({ where: { id: { in: authBucketIds } } });
  await prisma.$disconnect();
  if (server) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    else server.kill();
  }
}
