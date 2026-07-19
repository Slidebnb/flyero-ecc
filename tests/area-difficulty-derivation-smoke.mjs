import assert from "node:assert/strict";
import { deriveAreaDifficulty } from "../src/lib/areaDifficulty.ts";

const rural = deriveAreaDifficulty({
  coverageAreaSqm: 2_000_000,
  households: 600,
  routeDistanceMeters: 35_000,
  routeDurationMinutes: 900,
  segmentCount: 1,
  confidence: "low",
  source: "area-formula",
  warehouseMatched: true,
  deliverabilityScore: 52,
  clientHint: "NORMAL",
});
assert.equal(rural.areaDifficulty, "RURAL");
assert.equal(rural.areaDifficultyFactor, "1.40");
assert.ok(rural.derivationReasons.length > 0);

const hard = deriveAreaDifficulty({
  coverageAreaSqm: 20_000,
  households: 200,
  routeDistanceMeters: 8_000,
  routeDurationMinutes: 500,
  segmentCount: 2,
  confidence: "low",
  source: "unavailable",
  warehouseMatched: false,
  deliverabilityScore: 30,
  clientHint: "NORMAL",
});
assert.equal(hard.areaDifficulty, "HARD");
assert.equal(hard.areaDifficultyFactor, "1.60");
assert.ok(hard.derivationReasons.includes("warehouse-unmatched"));

const normal = deriveAreaDifficulty({
  coverageAreaSqm: 100_000,
  households: 900,
  routeDistanceMeters: 2_500,
  routeDurationMinutes: 120,
  segmentCount: 1,
  confidence: "high",
  source: "licensed-import",
  warehouseMatched: true,
  deliverabilityScore: 90,
  clientHint: "HARD",
});
assert.equal(normal.areaDifficulty, "NORMAL");
assert.equal(normal.areaDifficultyFactor, "1.00");
console.log("Area difficulty derivation smoke checks passed.");
