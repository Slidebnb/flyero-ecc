import { readFileSync } from "node:fs";

const seo = readFileSync("src/app/seo.ts", "utf8");
const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
const marketing = readFileSync("src/app/components/marketing/index.tsx", "utf8");
const industryData = readFileSync("src/app/branchen/industryData.ts", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(seo.includes('"https://flyero.org"'), "SEO-Fallback muss auf flyero.org zeigen.");
assert(!seo.includes("flyero.de"), "SEO-Quelle enthält noch die alte .de-Domain.");
assert(sitemap.includes("publicSeoRoutes"), "Sitemap muss die zentrale öffentliche SEO-Routenliste verwenden.");
assert(marketing.includes("ProcessPreview"), "Die öffentliche Nachweisansicht muss den ehrlichen Prozessstatus verwenden.");
assert(marketing.includes("keine echte Kampagne"), "Die Prozessansicht muss sichtbar als Beispiel gekennzeichnet sein.");
assert(!marketing.includes("/generated/marketing/flyero-hero-proof.png"), "Das Hero-Mockup darf nicht vom Production-Volume verdeckt werden.");
for (const path of ["/", "/verteilung-anfragen", "/verteilung-planen", "/fuer-unternehmen", "/fuer-verteiler", "/so-funktionierts", "/preise", "/kontakt", "/impressum", "/datenschutz", "/agb"]) {
  assert(seo.includes(`path: \"${path}\"`), `Sitemap-Route fehlt: ${path}`);
}
for (const slug of ["baeckereien", "gastronomie", "fitnessstudios", "handwerk", "immobilien", "einzelhandel", "events-vereine", "neueroeffnungen"]) {
  assert(industryData.includes(`path: \"/branchen/${slug}\"`), `Branchen-Sitemap-Route fehlt: ${slug}`);
}

console.log("SEO-Sitemap smoke checks passed.");
