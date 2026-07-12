import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RoutePoint = { lat: number; lng: number };

export type WalkingRouteEstimate = {
  distanceMeters: number;
  durationMinutes: number;
  path: RoutePoint[];
  provider: "haversine-fallback" | "google-directions-prepared";
};

export type AreaScoreInput = {
  city?: string | null;
  postalCode?: string | null;
  households?: number | null;
  flyerQuantity?: number | null;
  coverageAreaSqm?: number | null;
  distanceMeters?: number | null;
};

export function estimateRouteDistanceMeters(input: {
  coverageAreaSqm?: number | null;
  perimeterMeters?: number | null;
  households?: number | null;
}) {
  const area = Math.max(0, input.coverageAreaSqm ?? 0);
  const perimeter = Math.max(0, input.perimeterMeters ?? 0);
  const households = Math.max(0, input.households ?? 0);
  const deliveryPassMeters = Math.sqrt(area) * 0.52;
  const stopBufferMeters = households * 1.35;
  return Math.max(350, Math.round(perimeter * 1.14 + deliveryPassMeters + stopBufferMeters));
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateDistance(from: RoutePoint, to: RoutePoint) {
  if (![from.lat, from.lng, to.lat, to.lng].every(Number.isFinite)) return 0;
  const earthMeters = 6_371_000;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(earthMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function calculateWalkingRoute(points: RoutePoint[]): WalkingRouteEstimate {
  const clean = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  const distanceMeters = clean.reduce((sum, point, index) => {
    const previous = clean[index - 1];
    return previous ? sum + calculateDistance(previous, point) : sum;
  }, 0);
  const adjustedDistance = Math.max(distanceMeters, clean.length > 1 ? distanceMeters * 1.18 : 0);
  return {
    distanceMeters: Math.round(adjustedDistance),
    durationMinutes: calculateDistributionTime({ distanceMeters: adjustedDistance }),
    path: clean,
    provider: process.env.GOOGLE_MAPS_SERVER_KEY ? "google-directions-prepared" : "haversine-fallback",
  };
}

export function calculateDistributionTime(input: {
  distanceMeters?: number | null;
  flyerQuantity?: number | null;
  households?: number | null;
  distributorCount?: number | null;
}) {
  const walkMinutes = Math.round((input.distanceMeters ?? 0) / 74);
  const deliveryStops = input.households ?? Math.round((input.flyerQuantity ?? 0) / 1.08);
  const deliveryMinutes = Math.round(deliveryStops * 0.16);
  const defaultTeamSize = Math.max(1, Math.ceil((input.flyerQuantity ?? 0) / 3500));
  const teamSize = Math.max(1, input.distributorCount ?? defaultTeamSize);
  return Math.max(30, Math.round((walkMinutes + deliveryMinutes) / teamSize));
}

export function estimateFlyerTime(flyerQuantity: number) {
  const households = estimateHouseholds({ flyerQuantity });
  return calculateDistributionTime({ flyerQuantity, households, distanceMeters: Math.sqrt(Math.max(flyerQuantity, 1)) * 105 });
}

export function estimateHouseholds(input: {
  flyerQuantity?: number | null;
  coverageAreaSqm?: number | null;
  cityDensityFactor?: number | null;
}) {
  if (input.coverageAreaSqm && input.coverageAreaSqm > 0) {
    const density = input.cityDensityFactor ?? 125;
    return Math.max(1, Math.round(input.coverageAreaSqm / density));
  }
  if (input.flyerQuantity && input.flyerQuantity > 0) return Math.max(1, Math.round(input.flyerQuantity / 1.08));
  const density = input.cityDensityFactor ?? 92;
  return Math.max(1, Math.round((input.coverageAreaSqm ?? 0) / density));
}

export function scoreArea(input: AreaScoreInput) {
  const hasPreciseArea = Boolean(input.coverageAreaSqm && input.coverageAreaSqm > 0);
  const hasRouting = Boolean(input.distanceMeters && input.distanceMeters > 0);
  const hasLocation = Boolean(input.postalCode || input.city);
  const households = input.households ?? estimateHouseholds({ flyerQuantity: input.flyerQuantity, coverageAreaSqm: input.coverageAreaSqm });
  const densityScore = input.coverageAreaSqm ? Math.min(30, Math.round((households / Math.max(input.coverageAreaSqm / 1_000_000, 0.1)) / 80)) : 8;
  return Math.max(0, Math.min(100, 30 + (hasLocation ? 20 : 0) + (hasPreciseArea ? 20 : 0) + (hasRouting ? 15 : 0) + densityScore));
}

function normalizeCity(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export async function calculateBestDistributor(input: {
  city?: string | null;
  postalCode?: string | null;
  flyerQuantity?: number | null;
}) {
  const distributors = await prisma.distributorProfile.findMany({
    where: { reviewStatus: "APPROVED", availableToday: true, user: { status: "ACTIVE" } },
    include: { user: true },
  });
  const city = normalizeCity(input.city);
  const scored = distributors.map((distributor) => {
    const address = distributor.address as { city?: string } | null;
    const distributorCity = normalizeCity(address?.city);
    const preferred = distributor.preferredAreas.some((area) => normalizeCity(area) === city);
    const cityMatch = distributorCity && distributorCity === city;
    const futureFlyers = distributor.currentAssignedFlyers + (input.flyerQuantity ?? 0);
    const capacityOk = futureFlyers <= distributor.maxFlyersPerDay;
    const score =
      42 +
      (preferred ? 24 : 0) +
      (cityMatch ? 18 : 0) +
      (capacityOk ? 12 : -20) +
      Math.round(Number(distributor.rating) * 2) -
      distributor.currentAssignedTours * 5;
    return {
      distributor,
      score: Math.max(0, Math.min(100, score)),
      reasons: [
        preferred ? "Gebiet passt" : null,
        cityMatch ? "nahe am Zielgebiet" : null,
        capacityOk ? "Kapazität frei" : "Kapazität prüfen",
      ].filter((item): item is string => Boolean(item)),
    };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  return best
    ? {
        distributorId: best.distributor.id,
        name: `${best.distributor.firstName} ${best.distributor.lastName}`,
        score: best.score,
        reasons: best.reasons,
      }
    : null;
}

export async function clusterOrders(input: { city?: string | null; postalCode?: string | null; days?: number; tenantId?: string | null }) {
  const since = new Date(Date.now() - (input.days ?? 90) * 24 * 60 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: since },
      ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId ?? "__no_tenant__" }),
      ...(input.city ? { city: { equals: input.city, mode: "insensitive" } } : {}),
      ...(input.postalCode ? { postalCode: { startsWith: input.postalCode.slice(0, 3) } } : {}),
    },
    select: {
      id: true,
      orderNumber: true,
      city: true,
      postalCode: true,
      targetAreaName: true,
      flyerQuantity: true,
      estimatedDistanceMeters: true,
      preferredStartDate: true,
      status: true,
    },
    orderBy: { preferredStartDate: "asc" },
    take: 40,
  });

  const groups = new Map<string, typeof orders>();
  for (const order of orders) {
    const key = `${normalizeCity(order.city)}:${order.postalCode.slice(0, 3)}`;
    groups.set(key, [...(groups.get(key) ?? []), order]);
  }

  return Array.from(groups.entries()).map(([key, groupedOrders]) => ({
    key,
    city: groupedOrders[0]?.city ?? null,
    postalCodePrefix: groupedOrders[0]?.postalCode.slice(0, 3) ?? null,
    orders: groupedOrders,
    totalFlyers: groupedOrders.reduce((sum, order) => sum + order.flyerQuantity, 0),
  }));
}

export async function combineOrders(input: { city?: string | null; postalCode?: string | null; tenantId?: string | null }) {
  const clusters = await clusterOrders(input);
  return clusters
    .filter((cluster) => cluster.orders.length >= 2)
    .map((cluster) => {
      const standaloneDistance = cluster.orders.reduce((sum, order) => sum + (order.estimatedDistanceMeters ?? Math.sqrt(order.flyerQuantity) * 95), 0);
      const combinedDistance = Math.round(standaloneDistance * 0.72);
      const savedDistance = Math.max(0, Math.round(standaloneDistance - combinedDistance));
      const savedMinutes = Math.round(savedDistance / 72);
      return {
        ...cluster,
        combinedDistanceMeters: combinedDistance,
        savedDistanceMeters: savedDistance,
        savedMinutes,
        savedCostEstimate: new Prisma.Decimal(savedMinutes * 0.45).toDecimalPlaces(2).toString(),
      };
    })
    .sort((a, b) => b.savedDistanceMeters - a.savedDistanceMeters);
}
