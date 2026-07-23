import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const script = readFileSync("scripts/import-alkis-boundaries.mjs", "utf8");
assert.match(script, /EPSG:4326/, "Der ALKIS-Import muss WGS84/EPSG:4326 verlangen.");
assert.match(script, /MultiPolygon/, "Der Import muss amtliche MultiPolygon-Gemeinden unterstützen.");
assert.match(script, /dataSourceType: "OFFICIAL"/, "ALKIS-Geometrien müssen als amtliche Quelle gespeichert werden.");
assert.match(script, /estimatedHouseholds: null/, "ALKIS-Verwaltungsgrenzen dürfen keine Haushalte erfinden.");
assert.match(script, /GeografischerName_GEN/, "Der VG250-Import muss den amtlichen Gemeindenamen aus dem VG250-Feld lesen.");
assert.match(script, /Gemeindeschlüssel_AGS/, "Der VG250-Import muss den stabilen amtlichen Gemeindeschlüssel verwenden.");
assert.match(script, /Keine DB-Schreiboperation ohne --apply/, "Der Import braucht einen sicheren Dry-Run.");
assert.match(readFileSync("src/app/api/maps/boundary-area/route.ts", "utf8"), /findOfficialBoundaries/);
assert.match(readFileSync("src/lib/spatialAreas.ts", "utf8"), /featureType === "LOCALITY"/);

console.log("ALKIS boundary import smoke test passed.");
