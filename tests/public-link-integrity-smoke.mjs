import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.PUBLIC_LINK_BASE_URL || "http://localhost:3000";
const publicRoutes = [
  "/",
  "/verteilung-planen",
  "/verteilung-anfragen",
  "/preise",
  "/kontakt",
  "/so-funktionierts",
  "/fuer-unternehmen",
];

const browser = await chromium.launch({ headless: true });
const links = new Set();

try {
  for (const route of publicRoutes) {
    const page = await browser.newPage();
    await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle" });
    const hrefs = await page.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")));
    for (const href of hrefs) {
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
      const url = new URL(href, baseUrl);
      if (url.origin === new URL(baseUrl).origin) links.add(`${url.pathname}${url.search}`);
    }
    await page.close();
  }

  const failures = [];
  for (const path of [...links].sort()) {
    const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });
    if (response.status >= 400) failures.push(`${path} -> ${response.status}`);
  }

  assert.deepEqual(failures, [], `Öffentliche Links liefern Fehler: ${failures.join(", ")}`);
  console.log(`Public link integrity smoke passed (${links.size} interne Links geprüft).`);
} finally {
  await browser.close();
}