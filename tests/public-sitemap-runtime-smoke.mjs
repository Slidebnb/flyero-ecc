import assert from "node:assert/strict";

const baseUrl = (process.env.SITEMAP_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

async function fetchChecked(path) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  const body = await response.text();
  assert.equal(response.status, 200, `Oeffentliche Sitemap-URL ${path} antwortete mit ${response.status}.`);
  assert.doesNotMatch(body, /Systemhinweis|Da ist etwas schiefgelaufen|Application error/i, `Oeffentliche Seite ${path} zeigt einen Systemfehler.`);
}

const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`, { redirect: "manual" });
const sitemap = await sitemapResponse.text();
assert.equal(sitemapResponse.status, 200, `Sitemap antwortete mit ${sitemapResponse.status}.`);

const locations = sitemap
  .split("<loc>")
  .slice(1)
  .map((entry) => entry.split("</loc>")[0])
  .filter(Boolean)
  .map((location) => new URL(location));

assert.ok(locations.length > 0, "Sitemap enthaelt keine oeffentlichen URLs.");

for (const location of locations) {
  await fetchChecked(`${location.pathname}${location.search}`);
}

console.log(`Public sitemap runtime checks passed: ${locations.length} URLs.`);
