import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const component = readFileSync("src/app/components/marketing/IndustryLandingPage.tsx", "utf8");
const data = readFileSync("src/app/branchen/industryData.ts", "utf8");

assert(component.includes('page.slug === "immobilien"'), "Die Immobilien-Seite nutzt keine eigene Conversion-Darstellung.");
assert(component.includes("Ihre Immobilien. Direkt in die Haushalte Ihrer Wunschregion."), "Die Immobilien-H1 fehlt.");
assert(component.includes('href="/verteilung-planen">Verteilgebiet & Preis prüfen'), "Der direkte Planer-CTA fehlt.");
assert(component.includes("Nicht nur ein Objekt bewerben."), "Die Mehrfach-Objekt-Sektion fehlt.");
assert(component.includes("Für Immobilienmakler") && component.includes("Für Bauträger & Projektentwickler"), "Die Zielgruppen-Trennung fehlt.");
assert(component.includes("Druckservice anfragen"), "Der zurückhaltende Druckservice-Hinweis fehlt.");
assert(data.includes("Immobilienmarketing lokal") && data.includes("Immobilienkatalog verteilen"), "Die branchenspezifischen SEO-Begriffe fehlen.");
assert((component.match(/href=\"\/verteilung-planen\"/g) ?? []).length >= 3, "Der Planer-CTA wird nicht sinnvoll mehrfach angeboten.");
console.log("Immobilien conversion smoke checks passed.");
