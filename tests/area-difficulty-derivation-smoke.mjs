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

const logisticsPending = deriveAreaDifficulty({
  coverageAreaSqm: 1_280_000,
  households: 2_400,
  routeDistanceMeters: 8_000,
  routeDurationMinutes: 500,
  segmentCount: 2,
  confidence: "medium",
  source: "area-formula",
  warehouseMatched: false,
  deliverabilityScore: 80,
  clientHint: "NORMAL",
});
assert.equal(logisticsPending.areaDifficulty, "MIXED", "Fehlendes Lager darf die Gebietspreisklasse nicht auf HARD setzen.");
assert.equal(logisticsPending.areaDifficultyFactor, "1.15", "Die Gebietspreisklasse muss trotz offener LagerprÃ¼fung mit der Vorschau Ã¼bereinstimmen.");
assert.ok(logisticsPending.derivationReasons.includes("warehouse-unmatched"));

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

const unavailable = deriveAreaDifficulty({
  coverageAreaSqm: 0,
  households: 0,
  routeDistanceMeters: null,
  routeDurationMinutes: null,
  segmentCount: 1,
  confidence: "unavailable",
  source: "unavailable",
  warehouseMatched: true,
  deliverabilityScore: 100,
});
assert.equal(unavailable.areaDifficulty, "NORMAL");
assert.equal(unavailable.areaDifficultyFactor, "1.00");
assert.ok(unavailable.derivationReasons.includes("area-data-unavailable"));

console.log("Area difficulty derivation smoke checks passed.");
