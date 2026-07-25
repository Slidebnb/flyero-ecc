import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const spatialAreas = readFileSync("src/lib/spatialAreas.ts", "utf8");

assert.match(
  spatialAreas,
  /WITH source AS \(/,
  "Die Gebiets-Geometrie muss die Quelldaten vor dem UPDATE in einer CTE berechnen.",
);
assert.doesNotMatch(
  spatialAreas,
  /FROM LATERAL \(/,
  "Die Update-Abfrage darf die Zieltabellen-Korrelation nicht erneut als LATERAL-Unterabfrage formulieren.",
);
assert.match(
  spatialAreas,
  /UPDATE "DistributionArea" AS area[\s\S]*?SET "spatialGeometry" = source\.geometry[\s\S]*?FROM source[\s\S]*?WHERE area\.id/,
  "Die Update-Abfrage muss die CTE als FROM-Quelle verbinden.",
);

console.log("Order area spatial sync regression check passed.");
