export const MAX_ORDER_AREA_SEGMENTS = 50;
export const MAX_ORDER_AREA_POINTS = 500;

export type OrderAreaSegmentInput = {
  name?: unknown;
  city?: unknown;
  postalCode?: unknown;
  district?: unknown;
  country?: unknown;
  geometryGeoJson?: unknown;
  distributionAreaId?: unknown;
  centerLat?: unknown;
  centerLng?: unknown;
  flyerQuantity?: unknown;
  notes?: unknown;
};

export type NormalizedOrderAreaSegment = {
  sortOrder: number;
  name: string;
  city: string | null;
  postalCode: string | null;
  district: string | null;
  country: string;
  geometryGeoJson: FeatureCollection;
  centerLat: number | null;
  centerLng: number | null;
  areaSqm: number;
  distributionAreaId: string | null;
  flyerQuantity: number | null;
  notes: string | null;
};

export type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: { type: "Polygon"; coordinates: number[][][] };
  }>;
};

export type AggregatedOrderAreaSegments = {
  segments: NormalizedOrderAreaSegment[];
  totalAreaSqm: number;
  targetAreaGeoJson: FeatureCollection;
  primarySegment: NormalizedOrderAreaSegment;
};

function parseJson(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function finiteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function closeRing(ring: number[][]) {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) return first ? [...ring, [...first]] : ring;
  return ring;
}

function normalizeGeometry(value: unknown): FeatureCollection | null {
  const parsed = parseJson(value) as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== "object") return null;
  const rawFeatures = parsed.type === "FeatureCollection"
    ? parsed.features
    : parsed.type === "Feature"
      ? [parsed]
      : [{ type: "Feature", geometry: parsed }];
  if (!Array.isArray(rawFeatures)) return null;

  const features = rawFeatures.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const feature = candidate as Record<string, unknown>;
    const geometry = (feature.geometry && typeof feature.geometry === "object" ? feature.geometry : feature) as Record<string, unknown>;
    const polygonGeometries = geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)
      ? geometry.coordinates.flatMap((coordinates) => Array.isArray(coordinates)
        ? [{ type: "Polygon", coordinates }]
        : [])
      : geometry.type === "Polygon" && Array.isArray(geometry.coordinates)
        ? [{ type: "Polygon", coordinates: geometry.coordinates }]
        : [];
    return polygonGeometries.flatMap((polygon) => {
      const rings = polygon.coordinates
        .filter((ring): ring is unknown[] => Array.isArray(ring))
        .map((ring) => ring
          .filter((point): point is unknown[] => Array.isArray(point) && point.length >= 2)
          .map((point) => [finiteNumber(point[0]), finiteNumber(point[1])] as const)
          .filter((point): point is readonly [number, number] => point[0] !== null && point[1] !== null)
          .map(([lng, lat]) => [lng, lat]))
        .filter((ring) => ring.length >= 3)
        .map(closeRing);
      if (!rings.length || rings.some((ring) => ring.length > MAX_ORDER_AREA_POINTS + 1)) return [];
      return [{
        type: "Feature" as const,
        properties: (feature.properties && typeof feature.properties === "object" ? feature.properties : {}) as Record<string, unknown>,
        geometry: { type: "Polygon" as const, coordinates: rings },
      }];
    });
  });

  return features.length ? { type: "FeatureCollection", features } : null;
}

function polygonAreaSqm(ring: number[][]) {
  if (ring.length < 4) return 0;
  const metersPerDegree = 111_320;
  const averageLatitude = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
  const metersPerLongitudeDegree = Math.cos((averageLatitude * Math.PI) / 180) * metersPerDegree;
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    area += current[0] * metersPerLongitudeDegree * (next[1] * metersPerDegree)
      - next[0] * metersPerLongitudeDegree * (current[1] * metersPerDegree);
  }
  return Math.round(Math.abs(area / 2));
}

function geometryAreaSqm(geometry: FeatureCollection) {
  return Math.round(geometry.features.reduce((sum, feature) => sum + polygonAreaSqm(feature.geometry.coordinates[0]), 0));
}

export function normalizeOrderAreaSegments(value: unknown): NormalizedOrderAreaSegment[] {
  const parsed = parseJson(value);
  const candidates = Array.isArray(parsed) ? parsed : [];
  if (candidates.length > MAX_ORDER_AREA_SEGMENTS) throw new Error(`Maximal ${MAX_ORDER_AREA_SEGMENTS} Teilgebiete sind erlaubt.`);

  return candidates.map((candidate, index) => {
    const input = (candidate && typeof candidate === "object" ? candidate : {}) as OrderAreaSegmentInput;
    const geometryGeoJson = normalizeGeometry(input.geometryGeoJson);
    if (!geometryGeoJson) throw new Error(`Teilgebiet ${index + 1} enthält keine gültige Fläche.`);
    const city = text(input.city);
    const postalCode = text(input.postalCode);
    const name = text(input.name) ?? ([postalCode, city].filter(Boolean).join(" ") || `Teilgebiet ${index + 1}`);
    const flyerQuantity = finiteNumber(input.flyerQuantity);
    if (flyerQuantity !== null && (!Number.isInteger(flyerQuantity) || flyerQuantity < 0)) {
      throw new Error(`Flyerzahl für Teilgebiet ${index + 1} ist ungültig.`);
    }
    return {
      sortOrder: index,
      name,
      city,
      postalCode,
      district: text(input.district),
      country: text(input.country) ?? "DE",
      geometryGeoJson,
      areaSqm: geometryAreaSqm(geometryGeoJson),
      distributionAreaId: text(input.distributionAreaId),
      centerLat: finiteNumber(input.centerLat),
      centerLng: finiteNumber(input.centerLng),
      flyerQuantity,
      notes: text(input.notes),
    };
  }).filter((segment) => segment.areaSqm > 0);
}

export function aggregateOrderAreaSegments(value: unknown): AggregatedOrderAreaSegments | null {
  const segments = normalizeOrderAreaSegments(value);
  if (!segments.length) return null;
  return {
    segments,
    totalAreaSqm: segments.reduce((sum, segment) => sum + segment.areaSqm, 0),
    targetAreaGeoJson: {
      type: "FeatureCollection",
      features: segments.flatMap((segment) => segment.geometryGeoJson.features),
    },
    primarySegment: segments[0],
  };
}
