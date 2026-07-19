export type AreaDifficultyCode = "NORMAL" | "MIXED" | "LOW_DENSITY" | "RURAL" | "HARD";

export const AREA_DIFFICULTY_FACTORS: Record<AreaDifficultyCode, string> = {
  NORMAL: "1.00",
  MIXED: "1.15",
  LOW_DENSITY: "1.25",
  RURAL: "1.40",
  HARD: "1.60",
};

export type AreaDifficultyInput = {
  coverageAreaSqm: number;
  households: number;
  routeDistanceMeters: number | null;
  routeDurationMinutes: number | null;
  segmentCount: number;
  confidence?: string | null;
  source?: string | null;
  warehouseMatched: boolean;
  deliverabilityScore?: number | null;
  clientHint?: AreaDifficultyCode | null;
};

export type AreaDifficultyResult = {
  areaDifficulty: AreaDifficultyCode;
  areaDifficultyFactor: string;
  derivationReasons: string[];
};

export function deriveAreaDifficulty(input: AreaDifficultyInput): AreaDifficultyResult {
  const reasons: string[] = [];
  const densitySqmPerHousehold = input.households > 0 ? input.coverageAreaSqm / input.households : Number.POSITIVE_INFINITY;
  const routeMetersPerHousehold = input.households > 0 && input.routeDistanceMeters != null
    ? input.routeDistanceMeters / input.households
    : Number.POSITIVE_INFINITY;
  const lowConfidence = input.confidence === "low" || input.source === "unavailable" || !input.source;
  const score = input.deliverabilityScore ?? 100;

  if (!input.warehouseMatched) reasons.push("warehouse-unmatched");
  if (score < 45) reasons.push("low-deliverability");
  if (input.segmentCount > 2) reasons.push("multiple-segments");
  if (densitySqmPerHousehold > 1800) reasons.push("low-household-density");
  if (routeMetersPerHousehold > 45) reasons.push("long-route-per-household");
  if (lowConfidence) reasons.push("limited-area-data");

  let areaDifficulty: AreaDifficultyCode = "NORMAL";
  if (!input.warehouseMatched || score < 45) {
    areaDifficulty = "HARD";
  } else if (densitySqmPerHousehold > 1800 || routeMetersPerHousehold > 45) {
    areaDifficulty = "RURAL";
  } else if (input.segmentCount > 1 || score < 65 || densitySqmPerHousehold > 700 || routeMetersPerHousehold > 25) {
    areaDifficulty = "MIXED";
  } else if (lowConfidence && densitySqmPerHousehold > 350) {
    areaDifficulty = "LOW_DENSITY";
  }

  return {
    areaDifficulty,
    areaDifficultyFactor: AREA_DIFFICULTY_FACTORS[areaDifficulty],
    derivationReasons: reasons,
  };
}
