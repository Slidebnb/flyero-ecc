import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile("src/app/globals.css", "utf8");

assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.customerUnifiedBody\s*\{[\s\S]*?(?:display:\s*block|grid-template-columns:\s*1fr);/, "Das Kundenportal braucht mobil eine einspaltige Struktur.");
assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.customerSideNav\s*\{[\s\S]*?display:\s*none;/, "Die Desktop-Sidebar darf mobil nicht die Inhaltsbreite blockieren.");
assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.customerUnifiedContent\s*\{[\s\S]*?(?:width:\s*100%|min-width:\s*0);/, "Der Kundeninhalt muss mobil die verfuegbare Breite nutzen.");
assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.customerTwoColumn\s*\{[\s\S]*?grid-template-columns:\s*1fr;/, "Zweispaltige Kundenbereiche muessen mobil untereinander laufen.");
assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.customerCommandHero,\s*\.customerMissionGrid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/, "Das neue Dashboard muss mobil in einer klaren Spalte laufen.");

console.log("Customer portal mobile layout smoke checks passed.");
