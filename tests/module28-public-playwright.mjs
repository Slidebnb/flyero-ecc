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
    await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true });
    await page.close();
  }

  const anchorPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await anchorPage.goto(new URL("/fuer-unternehmen#zielgruppen", baseUrl).toString(), { waitUntil: "networkidle" });
  await anchorPage.waitForTimeout(700);
  const anchorTop = await anchorPage.locator("#zielgruppen").evaluate((element) => element.getBoundingClientRect().top);
  assert.ok(anchorTop >= -120 && anchorTop <= 180, "Zielgruppen-Anchor liegt nicht sichtbar unter dem Header.");
  await anchorPage.close();
  console.log("Module 28 public Playwright checks passed.");
} finally {
  await browser.close();
}
