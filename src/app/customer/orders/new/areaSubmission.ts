import type { PublicLocationContext } from "@/lib/publicLocationContext";

type AreaSegmentLike = {
  name?: unknown;
  city?: unknown;
  postalCode?: unknown;
  points?: unknown;
  geometryGeoJson?: unknown;
};

type AreaSubmissionInput = {
  segments: AreaSegmentLike[];
  city?: unknown;
  postalCode?: unknown;
  selectedLocation?: Pick<PublicLocationContext, "city" | "postalCode"> | null;
  targetAreaName?: unknown;
};

export type AreaSubmissionContext = {
  hasValidArea: boolean;
  city: string;
  postalCode: string;
  targetAreaName: string;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function isGermanPostalCode(value: string) {
  return /^\d{5}$/.test(value);
}

function hasPolygonGeometry(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: string; features?: unknown[]; geometry?: { type?: string; coordinates?: unknown }; coordinates?: unknown };
  if (candidate.type === "FeatureCollection") {
    return (candidate.features ?? []).some((feature) => hasPolygonGeometry(feature));
  }
  if (candidate.type === "Feature") return hasPolygonGeometry(candidate.geometry);
  return (candidate.type === "Polygon" || candidate.type === "MultiPolygon") && Array.isArray(candidate.coordinates);
}

export function hasAreaGeometry(segment: AreaSegmentLike) {
  return (Array.isArray(segment.points) && segment.points.length >= 3) || hasPolygonGeometry(segment.geometryGeoJson);
}

export function canCompleteAreaSelection(input: {
  hasValidArea: boolean;
  coverageAreaSqm: number;
  city: string;
  postalCode: string;
}) {
  if (!input.hasValidArea || !Number.isFinite(input.coverageAreaSqm) || input.coverageAreaSqm <= 0) return false;
  if (input.city.trim().length < 2) return false;
  return input.postalCode.trim() === "" || isGermanPostalCode(input.postalCode.trim());
}

export function resolveAreaCompletionContext(input: AreaSubmissionInput & { coverageAreaSqm: number }) {
  const submission = resolveAreaSubmissionContext(input);
  const isComplete = canCompleteAreaSelection({
    hasValidArea: submission.hasValidArea,
    coverageAreaSqm: input.coverageAreaSqm,
    city: submission.city,
    postalCode: submission.postalCode,
  });

  return {
    ...submission,
    coverageAreaSqm: input.coverageAreaSqm,
    isComplete,
  };
}

export function resolveAreaSubmissionContext(input: AreaSubmissionInput): AreaSubmissionContext {
  const selectedSegment = input.segments.find(hasAreaGeometry);
  const segmentCity = text(selectedSegment?.city);
  const selectedCity = text(input.selectedLocation?.city);
  const city = segmentCity || selectedCity || text(input.city);

  const segmentPostalCode = text(selectedSegment?.postalCode);
  const selectedPostalCode = text(input.selectedLocation?.postalCode);
  const inputPostalCode = text(input.postalCode);
  const postalCode = [segmentPostalCode, selectedPostalCode, inputPostalCode].find(isGermanPostalCode) ?? "";

  const targetAreaName = text(input.targetAreaName)
    || text(selectedSegment?.name)
    || [postalCode, city].filter(Boolean).join(" ")
    || "Verteilgebiet";

  return {
    hasValidArea: Boolean(selectedSegment),
    city,
    postalCode,
    targetAreaName,
  };
}
