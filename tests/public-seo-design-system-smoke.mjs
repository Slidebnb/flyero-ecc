import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const seo = read("src/app/seo.ts");
const marketing = read("src/app/components/marketing/index.tsx");
const mobileMenu = read("src/app/components/MobileMenu.tsx");
const planner = read("src/app/verteilung-planen/page.tsx");

assert(seo.includes("images: ["), "Öffentliche Seiten brauchen ein gemeinsames Social-Preview-Bild.");
assert(seo.includes("/marketing/flyero-hero-proof.png"), "Das Social-Preview-Bild muss aus dem vorhandenen FLYERO-Asset kommen.");
assert(seo.includes("creator: siteName") && seo.includes("publisher: siteName"), "Öffentliche SEO-Metadaten brauchen konsistente Herausgeberangaben.");
assert(marketing.includes('["Flyerverteilung", "/flyer-verteilen-lassen"]'), "Die zentrale Leistungsseite muss im öffentlichen Footer auffindbar sein.");
assert(marketing.includes('["Planung starten", "/verteilung-planen"]'), "Der direkte Planungsweg muss im öffentlichen Footer auffindbar sein.");
assert(marketing.includes('className="mkSkipLink"') && marketing.includes('id="main-content"'), "Marketingseiten brauchen einen Skip-Link zum Hauptinhalt.");
assert(planner.includes('className="mkSkipLink"') && planner.includes('id="main-content"'), "Der öffentliche Planer braucht ebenfalls einen Skip-Link zum Hauptinhalt.");
assert(mobileMenu.includes('aria-modal="true"'), "Das mobile öffentliche Menü muss als modaler Dialog ausgezeichnet sein.");
assert(marketing.includes('className="mkVisualFrame"'), "Der Hero braucht eine klar strukturierte Nachweis-Visualisierung.");
assert(marketing.includes('src="/marketing/flyero-doorstep-proof.jpg"'), "Der Homepage-Hero muss das freigegebene FLYERO-Motiv verwenden.");
assert(marketing.includes("Darstellung des Nachweisprinzips"), "Das Homepage-Motiv muss ehrlich und kundenverständlich eingeordnet werden.");
assert(marketing.includes('className="mkProofStatusTimeline"'), "Die Nachweis-Visualisierung braucht eine eigene Status-Timeline.");
assert(marketing.includes("Nur echte Unterlagen werden sichtbar."), "Die Nachweis-Visualisierung muss klar zwischen Planung und echten Unterlagen unterscheiden.");

console.log("Public SEO/design-system smoke checks passed.");
