import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { chromium } from "playwright";

const baseUrl = process.env.ROLE_PORTALS_BASE_URL || "http://localhost:3000";
const outDir = join(process.cwd(), ".tmp", "role-portals-playwright");
const password = "DemoPasswort123!";
const roles = [
  {
    name: "admin",
    email: "admin@example.com",
    ip: "198.51.100.51",
    routes: [
      "/admin/dashboard", "/admin/orders", "/admin/payments", "/admin/invoices", "/admin/dispatch",
      "/admin/reports", "/admin/distributors", "/admin/warehouse", "/admin/notifications", "/admin/settings",
      "/admin/accounting", "/admin/monitoring", "/admin/crm", "/admin/logistics", "/admin/print-orders",
      "/admin/support", "/admin/tours", "/admin/documents",
    ],
  },
  {
    name: "warehouse",
    email: "warehouse@example.com",
    ip: "198.51.100.52",
    routes: [
      "/warehouse/dashboard", "/warehouse/checkin", "/warehouse/inventory", "/warehouse/locations",
      "/warehouse/shipments", "/warehouse/stock-counts", "/warehouse/transfers",
    ],
  },
  {
    name: "distributor",
    email: "verteiler.approved1@example.com",
    ip: "198.51.100.53",
    routes: ["/distributor/dashboard", "/distributor/notifications", "/distributor/profile", "/distributor/support"],
  },
];
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let server = null;

function bucketId(scope, value) {
  return createHash("sha256").update(`flyero-auth-rate-limit:login:${scope}:${value}`).digest("hex");
}

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

async function login(page, role) {
  await page.goto(`${baseUrl}/login?next=${encodeURIComponent(role.routes[0])}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(role.email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click({ noWaitAfter: true });
  try {
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 });
  } catch (error) {
    const response = await page.request.post(`${baseUrl}/api/auth/login`, {
      data: { email: role.email, password, next: role.routes[0] },
      headers: { "x-forwarded-for": role.ip },
    });
    assert(response.ok(), `${role.name}: Login fehlgeschlagen (${response.status()}).`);
    await page.goto(`${baseUrl}${role.routes[0]}`, { waitUntil: "domcontentloaded" });
    if (new URL(page.url()).pathname.endsWith("/login")) throw error;
  }
}

await mkdir(outDir, { recursive: true });
await ensureServer();
const bucketIds = roles.flatMap((role) => [bucketId("account", role.email), bucketId("ip", role.ip)]);
await prisma.authRateLimitBucket.deleteMany({ where: { id: { in: bucketIds } } });

const browser = await chromium.launch();
try {
  for (const role of roles) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: { "x-forwarded-for": role.ip },
    });
    const page = await context.newPage();
    const errors = [];
    const failedRequests = [];
    const failedResponses = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("maps.googleapis.com/$rpc") && !message.text().includes("Failed to load resource: net::ERR_FAILED")) {
        errors.push(message.text());
      }
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? "unknown" }));
    page.on("response", (response) => {
      if (response.status() >= 400 && !response.url().includes("maps.googleapis.com") && !response.url().includes("maps.gstatic.com")) {
        failedResponses.push({ url: response.url(), status: response.status() });
      }
    });
    await login(page, role);
    for (const [index, route] of role.routes.entries()) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(200);
      assert.equal(new URL(page.url()).pathname, route, `${role.name}: ${route} leitet unerwartet weiter.`);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyText: document.body.innerText,
        overlay: [...document.querySelectorAll("[data-nextjs-dialog-overlay], nextjs-portal")].some((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 || rect.height > 0 || (element.textContent || "").trim().length > 0;
        }),
      }));
      assert.equal(metrics.scrollWidth, metrics.clientWidth, `${role.name}: ${route} erzeugt horizontale Überbreite.`);
      assert(!metrics.overlay, `${role.name}: ${route} zeigt ein Framework-Fehler-Overlay.`);
      if (index < 4) await page.screenshot({ path: join(outDir, `${role.name}-${index + 1}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [index, route] of role.routes.slice(0, 4).entries()) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(200);
      assert.equal(new URL(page.url()).pathname, route, `${role.name}: mobil ${route} leitet unerwartet weiter.`);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        overlay: [...document.querySelectorAll("[data-nextjs-dialog-overlay], nextjs-portal")].some((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 || rect.height > 0 || (element.textContent || "").trim().length > 0;
        }),
      }));
      assert.equal(metrics.scrollWidth, metrics.clientWidth, `${role.name}: mobil ${route} erzeugt horizontale Überbreite.`);
      assert(!metrics.overlay, `${role.name}: mobil ${route} zeigt ein Framework-Fehler-Overlay.`);
      if (index === 0) await page.screenshot({ path: join(outDir, `${role.name}-mobile.png`), fullPage: true });
    }
    const unexpectedFailedRequests = failedRequests.filter(({ url, error }) => {
      const isGoogleMaps = url.includes("maps.googleapis.com") || url.includes("maps.gstatic.com");
      const isLocalDevHmrAbort = baseUrl.startsWith("http://localhost") && url.startsWith(`${baseUrl}/_next/static/chunks/`) && error === "net::ERR_ABORTED";
      // Next cancels obsolete RSC prefetches when the test immediately navigates
      // to the next route. This is normal navigation behavior, not a page error.
      const isCancelledRscNavigation = url.includes("_rsc=") && error === "net::ERR_ABORTED";
      const isCancelledPlannerPrefetch = url.endsWith("/api/public/planner/experience") && error === "net::ERR_ABORTED";
      return !isGoogleMaps && !isLocalDevHmrAbort && !isCancelledRscNavigation && !isCancelledPlannerPrefetch;
    });
    assert.deepEqual(failedResponses, [], `${role.name}: HTTP-Fehler:\n${JSON.stringify(failedResponses, null, 2)}`);
    assert.deepEqual(errors, [], `${role.name}: Browserfehler:\n${errors.join("\n")}`);
    assert.deepEqual(unexpectedFailedRequests, [], `${role.name}: Ressourcenfehler:\n${JSON.stringify(unexpectedFailedRequests, null, 2)}`);
    await context.close();
  }
  console.log("Role portal Playwright checks passed: 18 admin, 7 warehouse and 4 distributor desktop routes plus mobile dashboard checks.");
} finally {
  await browser.close();
  await prisma.authRateLimitBucket.deleteMany({ where: { id: { in: bucketIds } } });
  await prisma.$disconnect();
  if (server) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    else server.kill();
  }
}
