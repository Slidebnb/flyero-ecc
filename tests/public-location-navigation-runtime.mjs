import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

let baseUrl = process.env.MODULE28_BASE_URL || "http://localhost:3049";
let serverProcess = null;

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
  const candidates = process.env.MODULE28_BASE_URL ? [baseUrl] : [baseUrl];
  for (const candidate of candidates) {
    try {
      const response = await fetch(`${candidate}/api/health`);
      if (response.ok) {
        baseUrl = candidate;
        return;
      }
    } catch {}
  }
  const port = new URL(baseUrl).port || "3000";
  const serverMode = process.env.MODULE28_SERVER_MODE || (existsSync(".next/BUILD_ID") ? "start" : "dev");
  serverProcess = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", serverMode, "--", "-p", port], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port, EMAIL_PROVIDER: "mock" },
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  await waitForHealth();
}

function locationData(postalCode, city) {
  return { postalCode, city, label: `${postalCode} ${city}`, lat: 50.35, lng: 7.59, placeId: `place-${postalCode}` };
}

async function stubGeocode(page, resolver) {
  await page.route("**/api/public/planner/geocode**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") || "";
    const result = await resolver(query);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: result }) });
  });
}

try {
  await ensureServer();
  const browser = await chromium.launch({ headless: true });

  const staleDraftContext = await browser.newContext();
  await staleDraftContext.addInitScript(() => {
    if (sessionStorage.getItem("module28-stale-draft-seeded")) return;
    sessionStorage.setItem("module28-stale-draft-seeded", "1");
    localStorage.setItem("flyero:order-planner:public-draft:v3", JSON.stringify({
      query: "35708 Haiger",
      city: "Haiger",
      postalCode: "35708",
      targetAreaName: "Haiger",
      center: { lat: 50.74, lng: 8.2 },
      polygon: [{ lat: 50.74, lng: 8.2 }, { lat: 50.75, lng: 8.2 }, { lat: 50.75, lng: 8.21 }],
      areaSegments: [{ id: "haiger", name: "Haiger", city: "Haiger", postalCode: "35708", points: [{ lat: 50.74, lng: 8.2 }, { lat: 50.75, lng: 8.2 }, { lat: 50.75, lng: 8.21 }], polygonSource: "drawn" }],
    }));
  });
  const stalePage = await staleDraftContext.newPage();
  await stalePage.route("**/api/public/planner/quote**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { metrics: { households: null, routeDistanceMeters: 0, routeDurationMinutes: 0, netPrice: "599.00", vatAmount: "113.81", grossPrice: "712.81", distributorNeed: 1, score: null, confidence: "low", source: "test", householdCountSource: "test", pricingVersion: "test", calculatedAt: new Date().toISOString(), calculationVersion: "test", needsManualReview: false, areaReference: null, fingerprint: "test-quote" } } }) });
  });
  await stalePage.route("**/api/public/planner/experience**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await stalePage.route("**/api/public/planner/autocomplete**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) });
  });
  await stubGeocode(stalePage, () => locationData("56112", "Lahnstein"));
  await stalePage.goto(`${baseUrl}/verteilung-planen?query=56112`, { waitUntil: "domcontentloaded" });
  await stalePage.locator('[data-testid="order-location-input"]').waitFor();
  await stalePage.waitForTimeout(1200);
  assert.equal(await stalePage.locator('[data-testid="order-location-input"]').inputValue(), "56112 Lahnstein");
  const selectedLocation = await stalePage.locator(".selectedLocationBar").innerText();
  assert.match(selectedLocation, /56112 Lahnstein/);
  assert.doesNotMatch(selectedLocation, /Haiger|35708/);
  const storedDraft = JSON.parse(await stalePage.evaluate(() => localStorage.getItem("flyero:order-planner:public-draft:v3") || "{}"));
  assert.deepEqual(storedDraft, {});
  await staleDraftContext.close();

  const homepageContext = await browser.newContext();
  const homepage = await homepageContext.newPage();
  await homepage.route("**/api/public/planner/autocomplete**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [{ id: "place-56112", label: "56112 Lahnstein", description: "Lahnstein, Deutschland", city: "Lahnstein", postalCode: "56112", lat: 50.35, lng: 7.59, source: "google" }] }) });
  });
  await homepage.route("**/api/public/planner/geocode**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: locationData("56112", "Lahnstein") }) });
  });
  await homepage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await homepage.locator("#public-planner-query").fill("56112");
  await homepage.getByRole("option", { name: /56112 Lahnstein/ }).click();
  await homepage.waitForTimeout(100);
  await homepage.getByRole("button", { name: "Gebiet ansehen" }).click();
  await homepage.waitForURL(/\/verteilung-planen\?/);
  const navigationUrl = new URL(homepage.url());
  assert.equal(navigationUrl.searchParams.get("query"), "56112 Lahnstein");
  assert.equal(navigationUrl.searchParams.get("placeId"), "place-56112");
  assert.equal(navigationUrl.searchParams.get("postalCode"), "56112");
  assert.equal(navigationUrl.searchParams.get("city"), "Lahnstein");
  assert.equal(navigationUrl.searchParams.get("lat"), "50.35");
  assert.equal(navigationUrl.searchParams.get("lng"), "7.59");
  assert.equal(navigationUrl.searchParams.get("source"), "google");
  await homepageContext.close();

  const freeInputContext = await browser.newContext();
  const freeInputPage = await freeInputContext.newPage();
  await freeInputPage.route("**/api/public/planner/autocomplete**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) });
  });
  await freeInputPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await freeInputPage.locator("#public-planner-query").fill("unbekannter Ort");
  await freeInputPage.getByRole("button", { name: "Gebiet ansehen" }).click();
  await freeInputPage.waitForURL(/\/verteilung-planen\?query=/);
  const freeInputUrl = new URL(freeInputPage.url());
  assert.equal(freeInputUrl.searchParams.get("query"), "unbekannter Ort");
  for (const key of ["placeId", "postalCode", "city", "lat", "lng", "source"]) {
    assert.equal(freeInputUrl.searchParams.has(key), false, `Freie Eingabe darf ${key} nicht mitschicken.`);
  }
  await freeInputContext.close();

  const mismatchContext = await browser.newContext();
  const mismatchPage = await mismatchContext.newPage();
  await mismatchPage.route("**/api/public/planner/geocode**", async (route) => {
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, code: "PUBLIC_GEOCODE_POSTAL_MISMATCH", error: "Die eingegebene PLZ konnte nicht eindeutig gefunden werden. Bitte wählen Sie den passenden Ort aus den Vorschlägen." }),
    });
  });
  await mismatchPage.goto(`${baseUrl}/verteilung-planen?query=56112`, { waitUntil: "domcontentloaded" });
  await mismatchPage.locator('[data-testid="order-location-input"]').waitFor();
  await mismatchPage.waitForTimeout(700);
  assert.match(await mismatchPage.locator(".mapNotice").innerText(), /PLZ.*nicht eindeutig/i);
  assert.doesNotMatch(await mismatchPage.locator(".selectedLocationBar").innerText(), /Haiger|35708/);
  await mismatchContext.close();

  const raceContext = await browser.newContext();
  const racePage = await raceContext.newPage();
  await racePage.route("**/api/public/planner/geocode**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") || "";
    const slow = query.includes("56112");
    await new Promise((resolve) => setTimeout(resolve, slow ? 900 : 50));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: query.includes("56112") ? locationData("56112", "Lahnstein") : locationData("56068", "Koblenz") }) });
  });
  await racePage.goto(`${baseUrl}/verteilung-planen`, { waitUntil: "domcontentloaded" });
  const locationInput = racePage.locator('[data-testid="order-location-input"]');
  await locationInput.fill("56112");
  await locationInput.press("Enter");
  await locationInput.fill("56068");
  await locationInput.press("Enter");
  await racePage.waitForTimeout(1200);
  const raceLocation = await racePage.locator(".selectedLocationBar").innerText();
  assert.match(raceLocation, /56068 Koblenz/);
  assert.doesNotMatch(raceLocation, /Lahnstein|56112/);
  await raceContext.close();
  await browser.close();
  console.log("Module 28 public location navigation runtime checks passed.");
} finally {
  if (serverProcess) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(serverProcess.pid), "/t", "/f"], { stdio: "ignore" });
    else serverProcess.kill();
  }
}
