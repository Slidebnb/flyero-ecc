import { existsSync, readFileSync } from "node:fs";

function read(path) {
  if (!existsSync(path)) throw new Error(`${path} fehlt.`);
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const slugs = [
  "baeckereien",
  "gastronomie",
  "fitnessstudios",
  "handwerk",
  "immobilien",
  "einzelhandel",
  "events-vereine",
  "neueroeffnungen",
];
const data = read("src/app/branchen/industryData.ts");
const route = read("src/app/branchen/[slug]/page.tsx");
const component = read("src/app/components/marketing/IndustryLandingPage.tsx");
const marketing = read("src/app/components/marketing/index.tsx");
const seo = read("src/app/seo.ts");
const robots = read("src/app/robots.ts");

assert(route.includes("generateStaticParams"), "Branchenroute erzeugt keine statischen Parameter.");
assert(route.includes("generateMetadata"), "Branchenroute erzeugt keine individuellen Metadaten.");
assert(route.includes("notFound"), "Unbekannte Branchen-Slugs werden nicht abgefangen.");
assert(route.includes("IndustryLandingPage"), "Branchenroute nutzt keine gemeinsame Seitenkomponente.");
assert(component.includes("FAQItem"), "Branchen-Seite enthält keine FAQ-Komponente.");
assert(component.includes("/verteilung-planen"), "Branchen-Seite führt nicht zur Gebietsplanung.");
assert(component.includes("/verteilung-anfragen"), "Branchen-Seite führt nicht zur Anfrage.");
assert(marketing.includes("IndustryLandingPage"), "Branchen-Komponente wird nicht aus dem Marketing-Modul exportiert.");
assert(seo.includes("industrySeoRoutes"), "Branchenrouten fehlen in der zentralen SEO-Liste.");
assert(robots.includes('"/branchen"'), "Robots erlaubt den öffentlichen Branchenbereich nicht.");
assert(marketing.includes('title="Branchen"'), "Footer enthält keine Branchen-Navigation.");

for (const slug of slugs) {
  assert(data.includes(`slug: "${slug}"`), `Branchen-Slug fehlt: ${slug}`);
  assert(data.includes(`path: "/branchen/${slug}"`), `SEO-Pfad fehlt: ${slug}`);
}

const titles = [...data.matchAll(/title: "([^"]+)"/g)].map((match) => match[1]);
const descriptions = [...data.matchAll(/description: "([^"]+)"/g)].map((match) => match[1]);
assert(titles.length >= slugs.length, "Nicht jede Branche besitzt einen eigenen Titel.");
assert(new Set(titles).size === titles.length, "Branchen-Seitentitel sind nicht eindeutig.");
assert(descriptions.length >= slugs.length, "Nicht jede Branche besitzt eine eigene Description.");
assert(new Set(descriptions).size === descriptions.length, "Branchen-Descriptions sind nicht eindeutig.");
assert(!data.includes("Koblenz") && !data.includes("Bendorf") && !data.includes("Neuwied"), "Branchen-SEO darf nicht auf einzelne Städte begrenzt sein.");

console.log("Industry SEO smoke checks passed.");
