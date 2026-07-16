import { existsSync, readFileSync } from "node:fs";

function read(path) {
  if (!existsSync(path)) throw new Error(`${path} fehlt.`);
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const slugs = [
  "neueroeffnung",
  "events",
  "gutscheine",
  "saisonaktionen",
  "tag-der-offenen-tuer",
];

const data = read("src/app/anlaesse/occasionData.ts");
const route = read("src/app/flyer-fuer/[slug]/page.tsx");
const pillarComponent = read("src/app/components/marketing/FlyerDistributionPillarPage.tsx");
const marketing = read("src/app/components/marketing/index.tsx");
const seo = read("src/app/seo.ts");
const robots = read("src/app/robots.ts");

assert(route.includes("generateStaticParams"), "Anlassroute erzeugt keine statischen Parameter.");
assert(route.includes("generateMetadata"), "Anlassroute erzeugt keine individuellen Metadaten.");
assert(route.includes("notFound"), "Unbekannte Anlass-Slugs werden nicht abgefangen.");
assert(route.includes("IndustryLandingPage"), "Anlassroute nutzt keine gemeinsame Marketing-Komponente.");
assert(pillarComponent.includes("FAQItem"), "Pillar-Seite enthält keine FAQ-Komponente.");
assert(pillarComponent.includes("/verteilung-planen"), "Pillar-Seite führt nicht zur Gebietsplanung.");
assert(pillarComponent.includes("/verteilung-anfragen"), "Pillar-Seite führt nicht zur Anfrage.");
assert(seo.includes("occasionSeoRoutes"), "Anlassrouten fehlen in der zentralen SEO-Liste.");
assert(seo.includes('path: "/flyer-verteilen-lassen"'), "Pillar-Route fehlt in der zentralen SEO-Liste.");
assert(robots.includes('"/flyer-fuer"'), "Robots erlaubt den öffentlichen Anlassbereich nicht.");
assert(marketing.includes('title="Anlässe"'), "Footer enthält keine Anlass-Navigation.");

for (const slug of slugs) {
  assert(data.includes(`slug: "${slug}"`), `Anlass-Slug fehlt: ${slug}`);
  assert(data.includes(`path: "/flyer-fuer/${slug}"`), `SEO-Pfad fehlt: ${slug}`);
}

const titles = [...data.matchAll(/title: "([^"]+)"/g)].map((match) => match[1]);
const descriptions = [...data.matchAll(/description: "([^"]+)"/g)].map((match) => match[1]);
assert(titles.length >= slugs.length, "Nicht jeder Anlass besitzt einen eigenen Titel.");
assert(new Set(titles).size === titles.length, "Anlass-Seitentitel sind nicht eindeutig.");
assert(descriptions.length >= slugs.length, "Nicht jeder Anlass besitzt eine eigene Description.");
assert(new Set(descriptions).size === descriptions.length, "Anlass-Descriptions sind nicht eindeutig.");
assert(!data.includes("Koblenz") && !data.includes("Bendorf") && !data.includes("Neuwied"), "Anlass-SEO darf nicht auf einzelne Städte begrenzt sein.");
assert(!pillarComponent.includes("Koblenz") && !pillarComponent.includes("Bendorf") && !pillarComponent.includes("Neuwied"), "Pillar-SEO darf nicht auf einzelne Städte begrenzt sein.");

console.log("Occasion SEO smoke checks passed.");
