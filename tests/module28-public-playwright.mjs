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
  ["planner-desktop", "/verteilung-planen?query=56112", 1440, 900],
  ["planner-mobile", "/verteilung-planen?query=56112", 390, 844],
  ["contact-desktop", "/kontakt", 1440, 900],
  ["contact-mobile", "/kontakt", 390, 844],
  ["how-it-works-desktop", "/so-funktionierts", 1440, 900],
  ["how-it-works-mobile", "/so-funktionierts", 390, 844],
  ["business-desktop", "/fuer-unternehmen", 1440, 900],
  ["business-mobile", "/fuer-unternehmen", 390, 844],
];

try {
  for (const [name, path, width, height] of targets) {
    const page = await browser.newPage({ viewport: { width, height } });
    if (path.startsWith("/verteilung-planen")) {
      // Keep the browser contract deterministic. Provider/API behavior is
      // covered by the public runtime tests; this smoke verifies the planner
      // consumes the authoritative location payload correctly.
      await page.route("**/api/public/planner/geocode**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              city: "Lahnstein",
              postalCode: "56112",
              label: "56112 Lahnstein",
              placeId: "playwright-place-56112",
              source: "google",
              lat: 50.3499,
              lng: 7.5946,
            },
          }),
        });
      });
    }
    // Google Maps keeps loading external map resources after the document is
    // usable, so networkidle is not a stable readiness signal for the planner.
    await page.goto(new URL(path, baseUrl).toString(), { waitUntil: "domcontentloaded" });
    await page.locator("h1").waitFor({ state: "visible" });
    if (path.startsWith("/verteilung-planen")) {
      await page.locator('[data-testid="order-location-input"]').waitFor({ state: "visible" });
    }
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyText: document.body.innerText,
    }));
    assert.equal(metrics.scrollWidth, metrics.clientWidth, `${path} hat horizontalen Überlauf bei ${width}px.`);
    assert.doesNotMatch(metrics.bodyText, /GPS-Nachweis aktiv|Tour Koblenz|Zustellquote geprüft|Druckoption wählen/);
    assert.equal(await page.locator("h1").count(), 1, `${path} must have exactly one H1.`);
    assert.equal(await page.locator('link[rel="canonical"]').count(), 1, `${path} needs exactly one canonical link.`);
    if (name === "planner-mobile") {
      const locationValue = await page.locator('[data-testid="order-location-input"]').inputValue();
      assert.equal(locationValue, "56112 Lahnstein", "Eine ausgewählte PLZ darf im mobilen Planner nicht mit abgeschnittenem Deutschland-Label angezeigt werden.");
    }
    await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true });
    await page.close();
  }

  const menuPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await menuPage.goto(new URL("/", baseUrl).toString(), { waitUntil: "domcontentloaded" });
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
  await inquiryPage.goto(new URL("/verteilung-anfragen", baseUrl).toString(), { waitUntil: "domcontentloaded" });
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
  await anchorPage.goto(new URL("/fuer-unternehmen#zielgruppen", baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await anchorPage.waitForFunction(() => {
    const element = document.querySelector("#zielgruppen");
    if (!element) return false;
    const top = element.getBoundingClientRect().top;
    return top >= -120 && top <= 180;
  }, { timeout: 5000 });
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
