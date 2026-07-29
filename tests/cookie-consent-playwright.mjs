import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3105";
const qaDir = path.join(process.cwd(), ".qa-cookie-consent");
await fs.mkdir(qaDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const experienceRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/public/planner/experience")) experienceRequests.push(request);
  });

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(qaDir, "desktop.png"), fullPage: false });
  await page.getByTestId("cookie-consent-banner").waitFor();
  assert.equal(await page.getByTestId("cookie-consent-banner").isVisible(), true);
  await page.getByTestId("cookie-consent-reject").click();
  assert.equal(await page.getByTestId("cookie-consent-banner").count(), 0);
  assert.match((await context.cookies()).find((cookie) => cookie.name === "flyero_cookie_consent_v1")?.value ?? "", /statistics/);

  await page.goto(`${baseUrl}/verteilung-planen?query=56112`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  assert.equal(experienceRequests.length, 0, "Optionale Statistik darf ohne Zustimmung nicht senden.");

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Cookie-Einstellungen" }).click();
  await page.getByRole("heading", { name: "Deine Cookie-Einstellungen" }).waitFor();
  const statistics = page.locator(".cookieConsentOptionInteractive input[type=checkbox]");
  assert.equal(await statistics.isChecked(), false);
  await statistics.check();
  await page.getByTestId("cookie-consent-save").click();
  assert.equal((await context.cookies()).find((cookie) => cookie.name === "flyero_cookie_consent_v1")?.value.includes("statistics"), true);

  await page.setViewportSize({ width: 390, height: 844 });
  await context.clearCookies();
  await page.reload({ waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(qaDir, "mobile.png"), fullPage: false });
  assert.equal(await page.getByTestId("cookie-consent-banner").isVisible(), true);
  const mobileBannerBox = await page.getByTestId("cookie-consent-banner").boundingBox();
  assert(mobileBannerBox, "Cookie-Hinweis muss mobil sichtbar messbar sein.");
  await page.getByTestId("cookie-consent-reject").click();
  assert.equal(await page.getByTestId("cookie-consent-banner").count(), 0);
  console.log(`Cookie consent Playwright passed: ${qaDir}`);
} finally {
  await browser.close();
}
