import { existsSync, readFileSync } from "node:fs";

const seo = readFileSync("src/app/seo.ts", "utf8");
const robots = readFileSync("src/app/robots.ts", "utf8");
const seoIntentData = readFileSync("src/app/seoIntentData.ts", "utf8");
const marketing = readFileSync("src/app/components/marketing/index.tsx", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const localRoutes = [
  { path: "/flyerverteilung-bendorf", city: "Bendorf" },
  { path: "/flyerverteilung-koblenz", city: "Koblenz" },
  { path: "/flyerverteilung-neuwied", city: "Neuwied" },
];

for (const route of localRoutes) {
  assert(existsSync(`src/app${route.path}/page.tsx`), `Lokale SEO-Seite fehlt: ${route.path}`);
  assert(seoIntentData.includes(`path: "${route.path}"`), `Lokale SEO-Daten fehlen: ${route.path}`);
  assert(seoIntentData.includes(route.city), `Lokaler Stadtbezug fehlt: ${route.city}`);
  assert(seoIntentData.includes(`Flyerverteilung ${route.city}`), `Lokaler Seitentitel/Keyword fehlt: ${route.city}`);
  assert(robots.includes(`"${route.path}"`), `Robots-Allowlist fehlt: ${route.path}`);
}

assert(seo.includes("seoIntentRoutes"), "Sitemap muss lokale SEO-Seiten ueber seoIntentRoutes aufnehmen.");
assert(marketing.includes("/flyerverteilung-bendorf"), "Footer-Link fuer Bendorf fehlt.");
assert(marketing.includes("/flyerverteilung-koblenz"), "Footer-Link fuer Koblenz fehlt.");
assert(marketing.includes("/flyerverteilung-neuwied"), "Footer-Link fuer Neuwied fehlt.");

assert(existsSync("src/app/llms.txt/route.ts"), "llms.txt Route fehlt.");
const llms = readFileSync("src/app/llms.txt/route.ts", "utf8");
for (const route of localRoutes) {
  assert(llms.includes(route.path), `llms.txt enthaelt ${route.path} nicht.`);
}
assert(llms.includes("text/plain"), "llms.txt muss als text/plain ausgeliefert werden.");
assert(llms.includes("Disallow: /admin"), "llms.txt muss interne Adminbereiche ausschliessen.");
assert(llms.includes("Disallow: /customer"), "llms.txt muss Kundenportalbereiche ausschliessen.");

console.log("Local SEO smoke checks passed.");
