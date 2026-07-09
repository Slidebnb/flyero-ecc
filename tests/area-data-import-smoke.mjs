import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(filePath, snippets) {
  const content = readFileSync(filePath, "utf8");
  for (const snippet of snippets) {
    assert(content.includes(snippet), `${filePath} enthaelt nicht: ${snippet}`);
  }
  return content;
}

includes("prisma/schema.prisma", [
  "enum AreaDataSourceType",
  "OFFICIAL",
  "LICENSED",
  "geometryGeoJson",
  "dataSourceName",
  "dataSourceType",
  "licenseNote",
  "dataUpdatedAt",
  "estimatedResidents",
  "estimatedDwellings",
  "residentialBuildings",
  "OFFICIAL_IMPORT",
  "LICENSED_IMPORT",
  "AREA_INTERPOLATION",
  "BUILDING_ESTIMATE",
]);

includes("prisma/migrations/20260710090000_area_data_v1/migration.sql", [
  "AreaDataSourceType",
  "geometryGeoJson",
  "estimatedResidents",
  "sourceYear",
  "validFrom",
]);

includes("scripts/import-distribution-areas.mjs", [
  "SOURCE_TYPES",
  "OFFICIAL_IMPORT",
  "LICENSED_IMPORT",
  "Keine DB-Schreiboperation ohne --apply",
]);

const template = includes("templates/distribution-areas-import-template.csv", [
  "postalCode,city,district,name,type,geometryGeoJson,estimatedHouseholds",
  "sourceType",
  "licenseNote",
]);
assert(template.split(/\r?\n/).filter(Boolean).length >= 4, "Import-Template braucht Kopfzeile plus Beispielzeilen.");

const validation = spawnSync(process.execPath, ["scripts/import-distribution-areas.mjs", "templates/distribution-areas-import-template.csv"], {
  cwd: process.cwd(),
  encoding: "utf8",
});
assert(validation.status === 0, `Import-Template validiert nicht: ${validation.stderr || validation.stdout}`);
assert(validation.stdout.includes("Import validiert"), "Importskript meldet keine erfolgreiche Validierung.");

const docs = includes("ORDER_AREA_DATA_QUALITY.md", [
  "Deutsche Post Direkt",
  "DATAFACTORY",
  "microdialog",
  "OSM/Geofabrik",
  "Zensus",
  "Confidence",
]);
assert(docs.includes("OFFICIAL") || docs.includes("official"), "Doku muss offizielle Quellenregel nennen.");
assert(docs.includes("LICENSED") || docs.includes("licensed") || docs.includes("lizenziert"), "Doku muss lizenzierte Quellenregel nennen.");

console.log("Area Data Import Smoke-Test erfolgreich abgeschlossen.");
