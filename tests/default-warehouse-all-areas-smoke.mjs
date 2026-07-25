import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const logistics = readFileSync("src/lib/logistics.ts", "utf8");
const smartMaps = readFileSync("src/lib/smartMaps.ts", "utf8");

assert.ok(
  logistics.indexOf("const defaultWarehouse = warehouses.find((warehouse) => warehouse.isDefault);")
    < logistics.indexOf("if (regionMatchesByWarehouse[0])"),
  "Das globale Standardlager muss vor regionalen Zuordnungen ausgewertet werden.",
);

assert.match(
  logistics,
  /isGlobalDefault:\s*true/,
  "Ein festgelegtes Standardlager muss als globale Zuordnung erkennbar sein.",
);
assert.match(
  smartMaps,
  /allowDefault:\s*true/,
  "Die operative Gebietsprüfung muss das festgelegte Standardlager für alle Gebiete berücksichtigen.",
);
assert.match(
  smartMaps,
  /matchedRegion:\s*Boolean\(match\?\.matchedRegion \|\| match\?\.isGlobalDefault\)/,
  "Ein globales Standardlager muss auch in Mehrgebiets-Kampagnen als zustellbar gelten.",
);
assert.match(
  smartMaps,
  /const singleAreaNeedsManualReview = Boolean\(!areaSelection && !warehouseMatch\?\.(?:matchedRegion|isGlobalDefault)/,
  "Einzelgebiete mit aktivem Standardlager dürfen nicht unnötig in die manuelle Prüfung fallen.",
);

console.log("Default warehouse all areas smoke checks passed.");
