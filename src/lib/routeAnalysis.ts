import { Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { asObject } from "@/lib/format";

export type RoutePoint = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  speed?: number | null;
  recordedAt: Date;
  flags?: unknown;
};

export type RoutePhoto = {
  lat?: number | null;
  lng?: number | null;
  takenAt?: Date | null;
};

export type RouteAnalysis = {
  pointCount: number;
  startTime: Date | null;
  endTime: Date | null;
  totalDurationSeconds: number;
  pauseSeconds: number;
  activeSeconds: number;
  distanceMeters: number;
  averageSpeedMps: number;
  maxSpeedMps: number;
  gaps: number;
  jumps: number;
  outsideTargetArea: number;
  flags: string[];
};

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  return Number(value.toString());
}

export function normalizeRoutePoint(point: {
  lat: Prisma.Decimal | number | string;
  lng: Prisma.Decimal | number | string;
  accuracy?: Prisma.Decimal | number | string | null;
  speed?: Prisma.Decimal | number | string | null;
  recordedAt: Date;
  flags?: unknown;
}): RoutePoint {
  return {
    lat: Number(point.lat.toString()),
    lng: Number(point.lng.toString()),
    accuracy: toNumber(point.accuracy),
    speed: toNumber(point.speed),
    recordedAt: point.recordedAt,
    flags: point.flags,
  };
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * radius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function polygonsFromGeoJson(value: unknown): Array<Array<{ lat: number; lng: number }>> {
  const geo = asObject(value);
  if (geo.type === "FeatureCollection" && Array.isArray(geo.features)) {
    return geo.features.flatMap((feature) => polygonsFromGeoJson(feature));
  }
  if (geo.type === "Feature") return polygonsFromGeoJson(geo.geometry);
  if (geo.type !== "Polygon" && geo.type !== "MultiPolygon") return [];
  if (!Array.isArray(geo.coordinates)) return [];
  const rings = geo.type === "Polygon" ? [geo.coordinates[0]] : geo.coordinates.map((polygon) => polygon?.[0]);
  return rings.filter(Array.isArray).map((ring) => ring
    .filter((point): point is [number, number] => Array.isArray(point) && point.length >= 2)
    .map(([lng, lat]) => ({ lat, lng })));
}

function isInsidePolygon(point: { lat: number; lng: number }, polygon: Array<{ lat: number; lng: number }>) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersects = yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function analyzeRoute(input: {
  points: RoutePoint[];
  pauseSeconds?: number | null;
  targetAreaGeoJson?: unknown;
}): RouteAnalysis {
  const points = [...input.points].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const flags = new Set<string>();
  if (points.length === 0) flags.add("NO_GPS");
  if (points.length > 0 && points.length < 3) flags.add("TOO_FEW_POINTS");

  let distance = 0;
  let maxSpeed = 0;
  let gaps = 0;
  let jumps = 0;
  let noMovementSeconds = 0;
  const polygons = polygonsFromGeoJson(input.targetAreaGeoJson);
  let outsideTargetArea = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    if (polygons.length > 0 && !polygons.some((polygon) => isInsidePolygon(current, polygon))) outsideTargetArea += 1;
    const pointFlags = Array.isArray(current.flags) ? current.flags : [];
    for (const flag of pointFlags) flags.add(String(flag).toUpperCase());
    if (current.speed && current.speed > 13.9) {
      flags.add("UNREALISTIC_SPEED");
      maxSpeed = Math.max(maxSpeed, current.speed);
    }
    if (index === 0) continue;
    const previous = points[index - 1];
    const segmentDistance = distanceMeters(previous, current);
    const seconds = Math.max((current.recordedAt.getTime() - previous.recordedAt.getTime()) / 1000, 1);
    const computedSpeed = segmentDistance / seconds;
    distance += segmentDistance;
    maxSpeed = Math.max(maxSpeed, computedSpeed);
    if (seconds > 300) {
      gaps += 1;
      flags.add("LARGE_GAP");
    }
    if (segmentDistance > 1500) {
      jumps += 1;
      flags.add("LARGE_GAP");
    }
    if (computedSpeed > 13.9) flags.add("UNREALISTIC_SPEED");
    if (segmentDistance < 3) noMovementSeconds += seconds;
  }

  if (outsideTargetArea > 0) flags.add("OUTSIDE_TARGET_AREA");
  if (noMovementSeconds > 120) flags.add("NO_MOVEMENT");
  const startTime = points[0]?.recordedAt ?? null;
  const endTime = points[points.length - 1]?.recordedAt ?? null;
  if (!startTime) flags.add("MISSING_START");
  if (!endTime) flags.add("MISSING_END");
  const totalDurationSeconds = startTime && endTime ? Math.max(Math.floor((endTime.getTime() - startTime.getTime()) / 1000), 0) : 0;
  const pauseSeconds = input.pauseSeconds ?? 0;
  const activeSeconds = Math.max(totalDurationSeconds - pauseSeconds, 0);

  return {
    pointCount: points.length,
    startTime,
    endTime,
    totalDurationSeconds,
    pauseSeconds,
    activeSeconds,
    distanceMeters: Math.round(distance),
    averageSpeedMps: activeSeconds > 0 ? distance / activeSeconds : 0,
    maxSpeedMps: maxSpeed,
    gaps,
    jumps,
    outsideTargetArea,
    flags: Array.from(flags),
  };
}

export async function auditRouteAnalysis(input: {
  userId?: string | null;
  tourId: string;
  analysis: RouteAnalysis;
}) {
  await createAuditLog({
    userId: input.userId ?? null,
    action: "route.analysis_generated",
    entityType: "DistributionTour",
    entityId: input.tourId,
    newValues: input.analysis,
  });
}
