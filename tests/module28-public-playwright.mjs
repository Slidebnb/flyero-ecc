import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.MODULE28_BASE_URL || "http://localhost:3000";
const outDir = join(process.cwd(), ".tmp", "module28-public-playwright");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const targets = [
  ["home-desktop", "/", 1440, 900],
  ["home-mobile", "/", 390, 844],
  ["home-mobile-small", "/", 375, 812],
  ["inquiry-desktop", "/verteilung-anfragen", 1440, 900],
  ["inquiry-mobile", "/verteilung-anfragen", 390, 844],
  ["pricing-desktop", "/preise", 1440, 900],
];

try {
  for (const [name, path, width, height] of targets) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(new URL(path, baseUrl).toString(), { waitUntil: "networkidle" });
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyText: document.body.innerText,
    }));
    assert.equal(metrics.scrollWidth, metrics.clientWidth, `${path} hat horizontalen Überlauf bei ${width}px.`);
    assert.doesNotMatch(metrics.bodyText, /GPS-Nachweis aktiv|Tour Koblenz|Zustellquote geprüft|Druckoption wählen/);
    assert.equal(await page.locator("h1").count(), 1, `${path} must have exactly one H1.`);
    assert.equal(await page.locator('link[rel="canonical"]').count(), 1, `${path} needs exactly one canonical link.`);
    await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true });
    await page.close();
  }

  const menuPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await menuPage.goto(new URL("/", baseUrl).toString(), { waitUntil: "networkidle" });
  const menuButton = menuPage.locator(".flyeroMobileMenuButton");
  assert.equal(await menuButton.count(), 1, "Mobile Navigation fehlt.");
  await menuButton.click();
  assert.equal(await menuButton.getAttribute("aria-expanded"), "true", "Hamburger-Menue muss sich oeffnen.");
  assert.ok(await menuPage.locator("#flyero-mobile-menu-panel").isVisible(), "Geoeffnetes Mobile-Menue ist nicht sichtbar.");
  await menuPage.keyboard.press("Escape");
  assert.equal(await menuButton.getAttribute("aria-expanded"), "false", "Hamburger-Menue muss per Escape schliessen.");
  await menuPage.locator("#public-planner-query").focus();
  assert.equal(await menuPage.locator("#public-planner-query").evaluate((element) => document.activeElement === element), true, "Planer-Suche muss per Tastatur fokussierbar sein.");
  assert.ok(await menuPage.locator('a[href="/verteilung-anfragen"]').count() > 0, "Haupt-CTA zur Anfrage fehlt.");
  await menuPage.close();

  const inquiryPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await inquiryPage.route("**/api/leads", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { id: "playwright-lead", inquiryNumber: "ANF-2026-PLAYWRIGHT", status: "NEW" } }),
    });
  });
  await inquiryPage.goto(new URL("/verteilung-anfragen", baseUrl).toString(), { waitUntil: "networkidle" });
  assert.ok(await inquiryPage.locator('a[href="/datenschutz"]').first().isVisible(), "Anfrageformular braucht einen sichtbaren Datenschutzlink.");
  await inquiryPage.locator('input[name="name"]').fill("Playwright Anfrage");
  await inquiryPage.locator('input[name="companyName"]').fill("FLYERO Testbetrieb");
  await inquiryPage.locator('input[name="email"]').fill("playwright@example.org");
  await inquiryPage.locator('input[name="phone"]').fill("+49 261 000000");
  await inquiryPage.locator('input[name="city"]').fill("Koblenz");
  await inquiryPage.locator('input[name="postalCode"]').fill("56068");
  await inquiryPage.locator('input[name="flyerQuantity"]').fill("3000");
  await inquiryPage.locator('input[name="startDate"]').fill("2026-08-01");
  await inquiryPage.locator('input[name="endDate"]').fill("2026-08-08");
  await inquiryPage.locator('select[name="flyersAlreadyPrinted"]').selectOption("true");
  await inquiryPage.locator('input[name="targetGroup"]').fill("Haushalte");
  await inquiryPage.locator('input[name="distributionMode"]').fill("Haushaltsverteilung");
  await inquiryPage.locator('textarea[name="message"]').fill("Bitte Gebiet und Ablauf pruefen.");
  await inquiryPage.locator('button[type="submit"]').click();
  await inquiryPage.getByText(/ANF-2026-PLAYWRIGHT/).waitFor();
  await inquiryPage.close();

  const anchorPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await anchorPage.goto(new URL("/fuer-unternehmen#zielgruppen", baseUrl).toString(), { waitUntil: "networkidle" });
  await anchorPage.waitForTimeout(700);
  const anchorTop = await anchorPage.locator("#zielgruppen").evaluate((element) => element.getBoundingClientRect().top);
  assert.ok(anchorTop >= -120 && anchorTop <= 180, "Zielgruppen-Anchor liegt nicht sichtbar unter dem Header.");
  const audienceCtas = anchorPage.locator("#zielgruppen .mkTextLink");
  assert.equal(await audienceCtas.count(), 6, "Jede Zielgruppe braucht einen eigenen Anfrage-CTA.");
  assert.ok(await audienceCtas.first().isVisible(), "Der Zielgruppen-CTA muss sichtbar sein.");
  await anchorPage.close();
  console.log("Module 28 public Playwright checks passed.");
} finally {
  await browser.close();
}
