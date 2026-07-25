import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const spatialAreas = readFileSync("src/lib/spatialAreas.ts", "utf8");

assert.match(
  spatialAreas,
  /UPDATE [\s\S]*?FROM LATERAL \(/,
  "Die Gebiets-Geometrie muss den äusseren DistributionArea-Alias per LATERAL sicher korrelieren.",
);

console.log("Order area spatial sync regression check passed.");
