import { existsSync, readFileSync } from "node:fs";

const seo = readFileSync("src/app/seo.ts", "utf8");
const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
const marketing = readFileSync("src/app/components/marketing/index.tsx", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(seo.includes('"https://flyero.org"'), "SEO-Fallback muss auf flyero.org zeigen.");
assert(!seo.includes("flyero.de"), "SEO-Quelle enthält noch die alte .de-Domain.");
assert(sitemap.includes("publicSeoRoutes"), "Sitemap muss die zentrale öffentliche SEO-Routenliste verwenden.");
assert(existsSync("public/marketing/flyero-hero-proof.png"), "Das Hero-Mockup muss außerhalb des gemounteten Generated-Verzeichnisses liegen.");
assert(marketing.includes('src="/marketing/flyero-hero-proof.png"'), "Das Hero-Mockup muss den produktionssicheren statischen Pfad verwenden.");
assert(!marketing.includes("/generated/marketing/flyero-hero-proof.png"), "Das Hero-Mockup darf nicht vom Production-Volume verdeckt werden.");
for (const path of ["/", "/verteilung-anfragen", "/verteilung-planen", "/fuer-unternehmen", "/fuer-verteiler", "/so-funktionierts", "/preise", "/kontakt", "/impressum", "/datenschutz", "/agb"]) {
  assert(seo.includes(`path: \"${path}\"`), `Sitemap-Route fehlt: ${path}`);
}

console.log("SEO-Sitemap smoke checks passed.");
