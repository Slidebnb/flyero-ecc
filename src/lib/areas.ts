import { AreaDataSourceType, DistributionAreaType, HouseholdEstimateMethod, Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { productionAreaWhere } from "@/lib/productionData";

type Position = [number, number];
type PolygonFeature = {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry: {
    type: "Polygon";
    coordinates: Position[][];
  };
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: PolygonFeature[];
};

type AreaInput = {
  name: string;
  type: DistributionAreaType;
  city?: string | null;
  postalCode?: string | null;
  district?: string | null;
  state?: string | null;
  country?: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
  radiusMeters?: number | null;
  geoJson?: unknown;
  geometryGeoJson?: unknown;
  estimatedHouseholds?: number | null;
  estimatedFlyers?: number | null;
  estimatedDistanceMeters?: number | null;
  coverageAreaSqm?: number | null;
  areaKm2?: number | null;
  googlePlaceId?: string | null;
  googleFeatureType?: string | null;
  dataSourceName?: string | null;
  dataSourceType?: AreaDataSourceType | null;
  dataSourceUrl?: string | null;
  licenseNote?: string | null;
  dataUpdatedAt?: Date | null;
  confidence?: number | null;
  householdEstimateMethod?: HouseholdEstimateMethod | null;
  householdSource?: string | null;
  householdSourceUrl?: string | null;
  householdSourceYear?: number | null;
  householdNotes?: string | null;
  reusable?: boolean;
  customerId?: string | null;
  tenantId?: string | null;
};

export function slugifyAreaName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "gebiet";
}

async function uniqueAreaSlug(name: string, currentId?: string) {
  const base = slugifyAreaName(name);
  let slug = base;
  let counter = 2;

  while (
    await prisma.distributionArea.findFirst({
      where: { slug, ...(currentId ? { id: { not: currentId } } : {}) },
      select: { id: true },
    })
  ) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
}

function isPosition(value: unknown): value is Position {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  );
}

function closeRing(ring: Position[]) {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function normalizePolygonFeature(value: unknown): PolygonFeature | null {
  const candidate = value as Partial<PolygonFeature>;
  const coordinates = candidate?.geometry?.coordinates;
  if (candidate?.type !== "Feature" || candidate.geometry?.type !== "Polygon" || !Array.isArray(coordinates)) {
    return null;
  }

  const rings = coordinates
    .map((ring) => (Array.isArray(ring) ? ring.filter(isPosition).map((point) => [Number(point[0]), Number(point[1])] as Position) : []))
    .filter((ring) => ring.length >= 3)
    .map(closeRing);

  if (rings.length === 0) return null;

  return {
    type: "Feature",
    properties: candidate.properties ?? {},
    geometry: { type: "Polygon", coordinates: rings },
  };
}

export function normalizeAreaGeoJson(value: unknown): FeatureCollection | null {
  if (!value) return null;
  const parsed = typeof value === "string" ? safeJson(value) : value;
  if (!parsed) return null;
  const candidate = parsed as Partial<FeatureCollection | PolygonFeature>;

  if (candidate.type === "FeatureCollection" && Array.isArray((candidate as FeatureCollection).features)) {
    const features = (candidate as FeatureCollection).features
      .map(normalizePolygonFeature)
      .filter((feature): feature is PolygonFeature => Boolean(feature));
    return features.length ? { type: "FeatureCollection", features } : null;
  }

  const feature = normalizePolygonFeature(candidate);
  return feature ? { type: "FeatureCollection", features: [feature] } : null;
}

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function polygonAreaSqm(points: Position[]) {
  if (points.length < 4) return 0;
  const metersPerDegreeLat = 111_320;
  const avgLat = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  const metersPerDegreeLng = Math.cos((avgLat * Math.PI) / 180) * metersPerDegreeLat;
  let area = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const [lngA, latA] = points[index];
    const [lngB, latB] = points[index + 1];
    area += lngA * metersPerDegreeLng * (latB * metersPerDegreeLat) - lngB * metersPerDegreeLng * (latA * metersPerDegreeLat);
  }

  return Math.abs(area / 2);
}

export function estimateCoverageAreaSqm(input: {
  type: DistributionAreaType;
  geoJson?: unknown;
  radiusMeters?: number | null;
  coverageAreaSqm?: number | null;
}) {
  if (input.coverageAreaSqm && input.coverageAreaSqm > 0) return Math.round(input.coverageAreaSqm);
  if (input.type === "RADIUS" && input.radiusMeters && input.radiusMeters > 0) {
    return Math.round(Math.PI * input.radiusMeters * input.radiusMeters);
  }

  const geoJson = normalizeAreaGeoJson(input.geoJson);
  if (!geoJson) return null;
  const area = geoJson.features.reduce((sum, feature) => sum + polygonAreaSqm(feature.geometry.coordinates[0]), 0);
  return area > 0 ? Math.round(area) : null;
}

function estimateDistanceMeters(coverageAreaSqm?: number | null) {
  if (!coverageAreaSqm) return null;
  return Math.round(Math.sqrt(coverageAreaSqm) * 3.2);
}

function estimateFlyers(households?: number | null) {
  return households ? Math.ceil(households * 1.08) : null;
}

function decimal(value?: number | null) {
  return value == null || Number.isNaN(value) ? undefined : new Prisma.Decimal(value);
}

function areaKm2FromSqm(coverageAreaSqm?: number | null, areaKm2?: number | null) {
  if (areaKm2 && areaKm2 > 0) return areaKm2;
  return coverageAreaSqm && coverageAreaSqm > 0 ? Number((coverageAreaSqm / 1_000_000).toFixed(6)) : null;
}

function confidenceDecimal(value?: number | null) {
  if (value == null || Number.isNaN(value)) return undefined;
  return new Prisma.Decimal(Math.max(0, Math.min(1, value)).toFixed(3));
}

async function logAreaHistory(input: {
  areaId: string;
  userId?: string | null;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await prisma.areaHistory.create({
    data: {
      areaId: input.areaId,
      userId: input.userId ?? null,
      action: input.action,
      oldValue: input.oldValue ?? undefined,
      newValue: input.newValue ?? undefined,
    },
  });
}

async function persistPolygons(areaId: string, geoJson: FeatureCollection | null) {
  await prisma.areaPolygon.deleteMany({ where: { areaId } });
  if (!geoJson) return;

  await prisma.areaPolygon.createMany({
    data: geoJson.features.map((feature, index) => ({
      areaId,
      sortOrder: index,
      geometry: feature as Prisma.InputJsonValue,
      areaSqm: decimal(polygonAreaSqm(feature.geometry.coordinates[0])),
    })),
  });
}

export async function createDistributionArea(input: AreaInput & { userId?: string | null }) {
  const geoJson = normalizeAreaGeoJson(input.geometryGeoJson ?? input.geoJson);
  const coverageAreaSqm = estimateCoverageAreaSqm({
    type: input.type,
    geoJson,
    radiusMeters: input.radiusMeters,
    coverageAreaSqm: input.coverageAreaSqm,
  });
  const estimatedFlyers = input.estimatedFlyers ?? estimateFlyers(input.estimatedHouseholds);
  const estimatedDistanceMeters = input.estimatedDistanceMeters ?? estimateDistanceMeters(coverageAreaSqm);
  const slug = await uniqueAreaSlug(input.name);

  const area = await prisma.distributionArea.create({
    data: {
      name: input.name,
      slug,
      type: input.type,
      city: input.city ?? null,
      postalCode: input.postalCode ?? null,
      district: input.district ?? null,
      state: input.state ?? null,
      country: input.country ?? "DE",
      centerLat: decimal(input.centerLat),
      centerLng: decimal(input.centerLng),
      radiusMeters: input.radiusMeters ?? null,
      geoJson: geoJson as Prisma.InputJsonValue ?? undefined,
      geometryGeoJson: geoJson as Prisma.InputJsonValue ?? undefined,
      coverageAreaSqm: decimal(coverageAreaSqm),
      areaKm2: decimal(areaKm2FromSqm(coverageAreaSqm, input.areaKm2)),
      estimatedHouseholds: input.estimatedHouseholds ?? null,
      estimatedFlyers,
      estimatedDistanceMeters,
      googlePlaceId: input.googlePlaceId ?? null,
      googleFeatureType: input.googleFeatureType ?? null,
      dataSourceName: input.dataSourceName ?? null,
      dataSourceType: input.dataSourceType ?? "ADMIN",
      dataSourceUrl: input.dataSourceUrl ?? null,
      licenseNote: input.licenseNote ?? null,
      dataUpdatedAt: input.dataUpdatedAt ?? null,
      confidence: confidenceDecimal(input.confidence),
      reusable: input.reusable ?? true,
      customerId: input.customerId ?? null,
      tenantId: input.tenantId ?? null,
      createdById: input.userId ?? null,
      estimates: input.estimatedHouseholds
        ? {
            create: {
              households: input.estimatedHouseholds,
              estimatedFlyers,
              distanceMeters: estimatedDistanceMeters,
              coverageAreaSqm: decimal(coverageAreaSqm),
              estimatedHouseholds: input.estimatedHouseholds,
              method: input.householdEstimateMethod ?? "ADMIN_ENTRY",
              source: input.householdSource ?? input.dataSourceName ?? "area-form",
              sourceUrl: input.householdSourceUrl ?? input.dataSourceUrl ?? null,
              sourceYear: input.householdSourceYear ?? input.dataUpdatedAt?.getFullYear() ?? null,
              confidence: confidenceDecimal(input.confidence),
              notes: input.householdNotes ?? input.licenseNote ?? null,
              validFrom: input.dataUpdatedAt ?? null,
              createdById: input.userId ?? null,
            },
          }
        : undefined,
    },
  });

  await persistPolygons(area.id, geoJson);
  await logAreaHistory({ areaId: area.id, userId: input.userId, action: "area.created", newValue: area });
  await createAuditLog({
    userId: input.userId,
    action: "area.created",
    entityType: "DistributionArea",
    entityId: area.id,
    newValues: { name: area.name, type: area.type, city: area.city, postalCode: area.postalCode },
  });

  return area;
}

export async function updateDistributionArea(input: AreaInput & { id: string; userId?: string | null; tenantId?: string | null }) {
  const existing = await prisma.distributionArea.findFirst({
    where: { id: input.id, ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId ?? "__no_tenant__" }) },
  });
  if (!existing || existing.status === "DELETED") throw new Error("Gebiet wurde nicht gefunden.");
  const geoJson = normalizeAreaGeoJson(input.geometryGeoJson ?? input.geoJson);
  const coverageAreaSqm = estimateCoverageAreaSqm({
    type: input.type,
    geoJson,
    radiusMeters: input.radiusMeters,
    coverageAreaSqm: input.coverageAreaSqm,
  });
  const estimatedFlyers = input.estimatedFlyers ?? estimateFlyers(input.estimatedHouseholds);
  const estimatedDistanceMeters = input.estimatedDistanceMeters ?? estimateDistanceMeters(coverageAreaSqm);
  const slug = input.name !== existing.name ? await uniqueAreaSlug(input.name, input.id) : existing.slug;

  const area = await prisma.distributionArea.update({
    where: { id: input.id },
    data: {
      name: input.name,
      slug,
      type: input.type,
      city: input.city ?? null,
      postalCode: input.postalCode ?? null,
      district: input.district ?? null,
      state: input.state ?? null,
      country: input.country ?? existing.country,
      centerLat: decimal(input.centerLat) ?? null,
      centerLng: decimal(input.centerLng) ?? null,
      radiusMeters: input.radiusMeters ?? null,
      geoJson: geoJson ? geoJson as Prisma.InputJsonValue : Prisma.JsonNull,
      geometryGeoJson: geoJson ? geoJson as Prisma.InputJsonValue : Prisma.JsonNull,
      coverageAreaSqm: decimal(coverageAreaSqm) ?? null,
      areaKm2: decimal(areaKm2FromSqm(coverageAreaSqm, input.areaKm2)) ?? null,
      estimatedHouseholds: input.estimatedHouseholds ?? null,
      estimatedFlyers,
      estimatedDistanceMeters,
      googlePlaceId: input.googlePlaceId ?? null,
      googleFeatureType: input.googleFeatureType ?? null,
      dataSourceName: input.dataSourceName ?? null,
      dataSourceType: input.dataSourceType ?? existing.dataSourceType,
      dataSourceUrl: input.dataSourceUrl ?? null,
      licenseNote: input.licenseNote ?? null,
      dataUpdatedAt: input.dataUpdatedAt ?? null,
      confidence: confidenceDecimal(input.confidence) ?? null,
      reusable: input.reusable ?? existing.reusable,
    },
  });

  if (input.estimatedHouseholds != null) {
    await prisma.areaHouseholdEstimate.create({
      data: {
        areaId: area.id,
        households: input.estimatedHouseholds,
        estimatedHouseholds: input.estimatedHouseholds,
        estimatedFlyers,
        distanceMeters: estimatedDistanceMeters,
        coverageAreaSqm: decimal(coverageAreaSqm),
        method: input.householdEstimateMethod ?? "ADMIN_ENTRY",
        source: input.householdSource ?? input.dataSourceName ?? "area-form",
        sourceUrl: input.householdSourceUrl ?? input.dataSourceUrl ?? null,
        sourceYear: input.householdSourceYear ?? input.dataUpdatedAt?.getFullYear() ?? null,
        confidence: confidenceDecimal(input.confidence),
        notes: input.householdNotes ?? input.licenseNote ?? null,
        validFrom: input.dataUpdatedAt ?? null,
        createdById: input.userId ?? null,
      },
    });
  }

  await persistPolygons(area.id, geoJson);
  await logAreaHistory({ areaId: area.id, userId: input.userId, action: "area.updated", oldValue: existing, newValue: area });
  await createAuditLog({
    userId: input.userId,
    action: "area.updated",
    entityType: "DistributionArea",
    entityId: area.id,
    oldValues: { name: existing.name, type: existing.type, status: existing.status },
    newValues: { name: area.name, type: area.type, status: area.status },
  });
  await notifyAdmins({
    type: "AREA_UPDATED",
    title: "Gebiet geändert",
    message: `Gebiet ${area.name} wurde aktualisiert.`,
  });

  return area;
}

export async function deleteDistributionArea(input: { id: string; userId?: string | null; tenantId?: string | null }) {
  const existing = await prisma.distributionArea.findFirst({
    where: { id: input.id, ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId ?? "__no_tenant__" }) },
  });
  if (!existing || existing.status === "DELETED") throw new Error("Gebiet wurde nicht gefunden.");
  const area = await prisma.distributionArea.update({
    where: { id: input.id },
    data: { status: "DELETED", reusable: false },
  });

  await logAreaHistory({ areaId: area.id, userId: input.userId, action: "area.deleted", oldValue: existing, newValue: area });
  await createAuditLog({
    userId: input.userId,
    action: "area.deleted",
    entityType: "DistributionArea",
    entityId: area.id,
    oldValues: { status: existing.status },
    newValues: { status: area.status },
  });
  await notifyAdmins({
    type: "AREA_DELETED",
    title: "Gebiet gelöscht",
    message: `Gebiet ${area.name} wurde deaktiviert.`,
  });

  return area;
}

export async function copyDistributionArea(input: { id: string; userId?: string | null; tenantId?: string | null }) {
  const existing = await prisma.distributionArea.findUnique({
    where: { id: input.id },
    include: { polygons: { orderBy: { sortOrder: "asc" } } },
  });
  if (!existing || existing.status === "DELETED") throw new Error("Gebiet wurde nicht gefunden.");
  if (input.tenantId !== undefined && existing.tenantId !== null && existing.tenantId !== input.tenantId) {
    throw new Error("Gebiet wurde nicht gefunden.");
  }

  return createDistributionArea({
    userId: input.userId,
    name: `${existing.name} Kopie`,
    type: existing.type,
    city: existing.city,
    postalCode: existing.postalCode,
    district: existing.district,
    state: existing.state,
    country: existing.country,
    centerLat: existing.centerLat ? Number(existing.centerLat) : null,
    centerLng: existing.centerLng ? Number(existing.centerLng) : null,
    radiusMeters: existing.radiusMeters,
    geoJson: existing.geoJson,
    geometryGeoJson: existing.geometryGeoJson,
    coverageAreaSqm: existing.coverageAreaSqm ? Number(existing.coverageAreaSqm) : null,
    areaKm2: existing.areaKm2 ? Number(existing.areaKm2) : null,
    estimatedHouseholds: existing.estimatedHouseholds,
    estimatedFlyers: existing.estimatedFlyers,
    estimatedDistanceMeters: existing.estimatedDistanceMeters,
    googlePlaceId: existing.googlePlaceId,
    googleFeatureType: existing.googleFeatureType,
    dataSourceName: existing.dataSourceName,
    dataSourceType: existing.dataSourceType,
    dataSourceUrl: existing.dataSourceUrl,
    licenseNote: existing.licenseNote,
    dataUpdatedAt: existing.dataUpdatedAt,
    confidence: existing.confidence ? Number(existing.confidence) : null,
    reusable: existing.reusable,
    customerId: input.tenantId === undefined ? existing.customerId : null,
    tenantId: input.tenantId === undefined ? existing.tenantId : input.tenantId,
  });
}

export async function assignAreaToOrder(input: {
  orderId: string;
  areaId: string;
  userId?: string | null;
}) {
  // Keep this legacy entry point safe for older callers. The quote and order
  // snapshot are authoritative; linking a reusable area must not overwrite them.
  return linkAreaReferenceToOrder(input);
}

/** Links a reusable area without replacing the order's authoritative snapshot. */
export async function linkAreaReferenceToOrder(input: {
  orderId: string;
  areaId: string;
  userId?: string | null;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, tenantId: true, orderNumber: true },
  });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");
  const area = await prisma.distributionArea.findFirst({
    where: {
      id: input.areaId,
      status: { not: "DELETED" },
      OR: [{ tenantId: null }, { tenantId: order.tenantId }],
    },
    select: { id: true, name: true },
  });
  if (!area) throw new Error("Gebiet wurde nicht gefunden.");

  const updatedOrder = await prisma.order.update({
    where: { id: input.orderId },
    data: { distributionAreaId: area.id },
  });

  await logAreaHistory({
    areaId: area.id,
    userId: input.userId,
    action: "area.reference_linked",
    newValue: { orderId: updatedOrder.id, orderNumber: order.orderNumber },
  });
  await createAuditLog({
    userId: input.userId,
    action: "area.reference_linked",
    entityType: "Order",
    entityId: updatedOrder.id,
    newValues: { areaId: area.id, areaName: area.name },
  });

  return { order: updatedOrder, area };
}

export async function listAreas(filters: {
  search?: string;
  type?: DistributionAreaType;
  city?: string;
  includeDeleted?: boolean;
  tenantId?: string | null;
}) {
  return prisma.distributionArea.findMany({
    where: {
      ...productionAreaWhere(),
      AND: [
        ...(filters.tenantId ? [{ OR: [{ tenantId: null }, { tenantId: filters.tenantId }] }] : []),
        ...(filters.search
          ? [{
              OR: [
                { name: { contains: filters.search, mode: "insensitive" as const } },
                { postalCode: { contains: filters.search, mode: "insensitive" as const } },
                { district: { contains: filters.search, mode: "insensitive" as const } },
              ],
            }]
          : []),
      ],
      ...(filters.includeDeleted ? {} : { status: { not: "DELETED" } }),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.city ? { city: { contains: filters.city, mode: "insensitive" } } : {}),
    },
    include: {
      polygons: { orderBy: { sortOrder: "asc" } },
      estimates: { orderBy: { createdAt: "desc" }, take: 1 },
      orders: { select: { id: true } },
    },
    orderBy: [{ status: "asc" }, { city: "asc" }, { name: "asc" }],
  });
}

export async function notifyAreaChangedForCustomers(areaId: string, type: "updated" | "deleted") {
  const orders = await prisma.order.findMany({
    where: { distributionAreaId: areaId },
    select: { customer: { select: { userId: true } }, orderNumber: true },
  });
  if (orders.length === 0) return;

  await Promise.all(orders.map((order) => createNotification({
      userId: order.customer.userId,
      type: type === "updated" ? "AREA_UPDATED" : "AREA_DELETED",
      title: type === "updated" ? "Gebiet geändert" : "Gebiet gelöscht",
      message: `Das Gebiet für Auftrag ${order.orderNumber} wurde ${type === "updated" ? "geändert" : "deaktiviert"}.`,
    })));
}
