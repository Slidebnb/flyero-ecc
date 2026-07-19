import type { AreaDifficultyCode } from "@/lib/areaDifficulty";

type JsonRecord = Record<string, unknown>;

export type ServerAreaCalculationMetrics = {
  source?: string | null;
  confidence?: string | null;
  households?: number | null;
  coverageAreaSqm?: number | null;
  routeDistanceMeters?: number | null;
  routeDurationMinutes?: number | null;
  calculationVersion?: string | null;
  calculatedAt?: string | null;
  areaReference?: unknown;
  householdCountSource?: string | null;
  pricingVersion?: string | null;
  pricingRuleSignature?: string | null;
  polygonHash?: string | null;
  fingerprint?: string | null;
  quote?: unknown;
  needsManualReview?: boolean;
  segments?: unknown[];
  warehouseMatches?: unknown[];
  areaDifficulty?: AreaDifficultyCode | null;
  areaDifficultyFactor?: string | null;
  derivationReasons?: string[];
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function boundedString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

export function buildServerAreaCalculationSnapshot(input: {
  clientSnapshot?: unknown;
  metrics: ServerAreaCalculationMetrics;
}) {
  const client = record(input.clientSnapshot);
  const selectedSegmentLabels = Array.isArray(client.selectedSegmentLabels)
    ? client.selectedSegmentLabels.filter((value): value is string => typeof value === "string").slice(0, 100).map((value) => value.slice(0, 160))
    : [];
  const metrics = input.metrics;

  return {
    polygonSource: boundedString(client.polygonSource, 40),
    userEditedPolygon: safeBoolean(client.userEditedPolygon),
    selectedSegmentLabels,
    uiMode: client.uiMode === "boundary" || client.uiMode === "draw" ? client.uiMode : null,
    source: boundedString(metrics.source, 120) ?? "unavailable",
    confidence: boundedString(metrics.confidence, 40) ?? "unavailable",
    households: safeNumber(metrics.households),
    coverageAreaSqm: safeNumber(metrics.coverageAreaSqm),
    routeDistanceMeters: safeNumber(metrics.routeDistanceMeters),
    routeDurationMinutes: safeNumber(metrics.routeDurationMinutes),
    calculationVersion: boundedString(metrics.calculationVersion, 80) ?? "order-area-v1",
    calculatedAt: boundedString(metrics.calculatedAt, 80) ?? new Date().toISOString(),
    areaReference: metrics.areaReference ?? null,
    householdCountSource: boundedString(metrics.householdCountSource, 160),
    pricingVersion: boundedString(metrics.pricingVersion, 80),
    pricingRuleSignature: boundedString(metrics.pricingRuleSignature, 160),
    polygonHash: boundedString(metrics.polygonHash, 160),
    quoteFingerprint: boundedString(metrics.fingerprint, 160),
    quote: metrics.quote ?? null,
    needsManualReview: Boolean(metrics.needsManualReview),
    segments: Array.isArray(metrics.segments) ? metrics.segments : [],
    warehouseMatches: Array.isArray(metrics.warehouseMatches) ? metrics.warehouseMatches : [],
    areaDifficulty: metrics.areaDifficulty ?? null,
    areaDifficultyFactor: boundedString(metrics.areaDifficultyFactor, 20),
    derivationReasons: Array.isArray(metrics.derivationReasons) ? metrics.derivationReasons.slice(0, 20) : [],
    clientDifficultyHint: boundedString(client.clientDifficultyHint ?? client.areaDifficulty, 30),
  };
}
