import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile("src/app/globals.css", "utf8");
const lastMobileBlock = css.slice(css.lastIndexOf("@media (max-width: 820px)"));

assert.match(lastMobileBlock, /\.customerUnifiedBody\s*\{[\s\S]*?grid-template-columns:\s*1fr;/, "Das Kundenportal braucht im finalen Mobile-Block eine einspaltige Struktur.");
assert.match(lastMobileBlock, /\.customerSideNav\s*\{[\s\S]*?display:\s*none;/, "Die Desktop-Sidebar darf mobil nicht die Inhaltsbreite blockieren.");
assert.match(lastMobileBlock, /\.customerUnifiedContent\s*\{[\s\S]*?width:\s*100%;/, "Der Kundeninhalt muss mobil die verfügbare Breite nutzen.");
assert.match(lastMobileBlock, /\.customerTwoColumn\s*\{[\s\S]*?grid-template-columns:\s*1fr;/, "Zweispaltige Kundenbereiche müssen mobil untereinander laufen.");

console.log("Customer portal mobile layout smoke checks passed.");
