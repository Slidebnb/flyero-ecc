import { existsSync, readFileSync } from "node:fs";

const seo = readFileSync("src/app/seo.ts", "utf8");
const seoIntentData = readFileSync("src/app/seoIntentData.ts", "utf8");
const robots = readFileSync("src/app/robots.ts", "utf8");
const marketing = readFileSync("src/app/components/marketing/index.tsx", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const intentRoutes = [
  "/flyerverteilung",
  "/prospektverteilung",
  "/haushaltswerbung",
  "/flyerverteilung-mit-gps-nachweis",
  "/bundesweite-flyerverteilung",
  "/flyerverteilung-kosten",
  "/gps-nachweis",
  "/qualitaetssicherung",
  "/haeufige-fragen",
  "/ratgeber",
  "/ratgeber/flyerverteilung-planen",
  "/ratgeber/richtige-flyer-auflage",
  "/ratgeber/verteilgebiet-bestimmen",
  "/ratgeber/flyerverteilung-kontrollieren",
];

for (const route of intentRoutes) {
  const pagePath = `src/app${route}/page.tsx`;
  assert(existsSync(pagePath), `SEO-Intent-Seite fehlt: ${route}`);
  assert(seoIntentData.includes(`path: "${route}"`), `SEO-Intent-Daten fehlen: ${route}`);
  assert(robots.includes(`"${route}"`), `Robots-Allowlist fehlt: ${route}`);
}

assert(seo.includes("seoIntentRoutes"), "publicSeoRoutes muss SEO-Intent-Routen zentral einbinden.");

for (const label of ["Prospektverteilung", "Haushaltswerbung", "GPS-Nachweis", "Ratgeber", "Qualitätssicherung"]) {
  assert(marketing.includes(label), `Footer/Navigation deckt Intent nicht ab: ${label}`);
}

for (const forbidden of ["billige Flyerverteilung", "guenstigste Verteilung", "Beispielhafter Ablauf", "keine echte Kampagne"]) {
  assert(!marketing.includes(forbidden), `Verbotener Public-Text gefunden: ${forbidden}`);
}

console.log("Public SEO intent coverage smoke checks passed.");
