import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isProductionRuntime } from "@/lib/productionData";

export type OfficialBoundary = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  postalCode: string | null;
  district: string | null;
  state: string | null;
  googlePlaceId: string | null;
  googleFeatureType: string | null;
  estimatedHouseholds: number | null;
  estimatedFlyers: number | null;
  coverageAreaSqm: number | null;
  areaKm2: number | null;
  centerLat: number | null;
  centerLng: number | null;
  confidence: number | null;
  dataSourceName: string | null;
  dataSourceType: string;
  geoJson: unknown;
};

type BoundaryRow = Omit<OfficialBoundary, "geoJson"> & { geoJson: string | null };

function finiteCoordinate(value: number | undefined) {
  return value != null && Number.isFinite(value) && Math.abs(value) <= 180 ? value : null;
}

function parseGeoJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function boundaryWhere() {
  return isProductionRuntime ? Prisma.sql`AND area."dataSourceType" <> 'SEED'` : Prisma.empty;
}

function typeWhere(featureType?: string) {
  if (featureType === "LOCALITY") return Prisma.sql`AND area."type" = 'CITY'`;
  if (featureType === "POSTAL_CODE") return Prisma.sql`AND area."type" = 'POSTAL_CODE'`;
  return Prisma.empty;
}

function text(value?: string | null) {
  return (value ?? "").trim().slice(0, 120);
}

function rowsToBoundaries(rows: BoundaryRow[]): OfficialBoundary[] {
  return rows.map((row) => ({ ...row, geoJson: parseGeoJson(row.geoJson) }));
}

async function spatialGeometryAvailable() {
  const columns = await prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'DistributionArea'
      AND column_name = 'spatialGeometry'
    LIMIT 1;
  `);
  return columns.length > 0;
}

export async function findOfficialBoundaries(input: {
  latitude?: number;
  longitude?: number;
  city?: string | null;
  postalCode?: string | null;
  featureType?: string | null;
  placeId?: string | null;
  limit?: number;
}) {
  if (!(await spatialGeometryAvailable())) {
    if (isProductionRuntime) throw new Error("Die PostGIS-Flächenspalte fehlt. Migration muss zuerst ausgeführt werden.");
    return [];
  }

  const latitude = finiteCoordinate(input.latitude);
  const longitude = finiteCoordinate(input.longitude);
  const city = text(input.city);
  const postalCode = text(input.postalCode);
  const placeId = text(input.placeId);
  const limit = Math.max(1, Math.min(input.limit ?? 20, 50));

  const rows = await prisma.$queryRaw<BoundaryRow[]>(Prisma.sql`
    SELECT
      area.id,
      area.name,
      area.type,
      area.city,
      area."postalCode",
      area.district,
      area.state,
      area."googlePlaceId",
      area."googleFeatureType",
      area."estimatedHouseholds",
      area."estimatedFlyers",
      area."coverageAreaSqm"::double precision AS "coverageAreaSqm",
      area."areaKm2"::double precision AS "areaKm2",
      ST_Y(ST_PointOnSurface(area."spatialGeometry")) AS "centerLat",
      ST_X(ST_PointOnSurface(area."spatialGeometry")) AS "centerLng",
      area.confidence::double precision AS confidence,
      area."dataSourceName",
      area."dataSourceType",
      ST_AsGeoJSON(area."spatialGeometry") AS "geoJson"
    FROM "DistributionArea" AS area
    WHERE area.status = 'ACTIVE'
      AND area.reusable = true
      AND area."dataSourceType" IN ('OFFICIAL', 'IMPORTED', 'LICENSED')
      AND area."spatialGeometry" IS NOT NULL
      ${boundaryWhere()}
      ${typeWhere((input.featureType ?? "").toUpperCase())}
      AND (${placeId} = '' OR area."googlePlaceId" = ${placeId})
      AND (${city} = '' OR lower(area.city) = lower(${city}) OR lower(area.name) = lower(${city}))
      AND (${postalCode} = '' OR area."postalCode" = ${postalCode} OR area."postalCode" IS NULL)
      AND (
        ${latitude == null || longitude == null}
        OR ST_Intersects(
          area."spatialGeometry",
          ST_SetSRID(ST_Point(${longitude}, ${latitude}), 4326)
        )
      )
    ORDER BY
      CASE WHEN ${placeId} <> '' AND area."googlePlaceId" = ${placeId} THEN 0 ELSE 1 END,
      CASE WHEN ${postalCode} <> '' AND area."postalCode" = ${postalCode} THEN 0 ELSE 1 END,
      ST_Area(area."spatialGeometry") ASC
    LIMIT ${limit};
  `);

  return rowsToBoundaries(rows);
}

export async function syncDistributionAreaSpatialGeometry(areaId: string) {
  // Older local databases can still create orders before the PostGIS migration
  // is applied. Production is guarded by the migration/preflight instead of
  // silently claiming that spatial selection is available.
  if (!(await spatialGeometryAvailable())) {
    if (isProductionRuntime) throw new Error("Die PostGIS-Flächenspalte fehlt. Migration muss zuerst ausgeführt werden.");
    return;
  }
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "DistributionArea" AS area
    SET "spatialGeometry" = source.geometry
    FROM (
      SELECT
        ST_Multi(
          ST_CollectionExtract(
            ST_UnaryUnion(ST_Collect(
              ST_SetSRID(
                ST_GeomFromGeoJSON(
                  (CASE
                    WHEN jsonb_typeof(feature.value -> 'geometry') = 'object' THEN feature.value -> 'geometry'
                    ELSE feature.value
                  END)::text
                ),
                4326
              )
            )),
            3
          )
        ) AS geometry
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(COALESCE(area."geometryGeoJson", area."geoJson") -> 'features') = 'array'
            THEN COALESCE(area."geometryGeoJson", area."geoJson") -> 'features'
          ELSE jsonb_build_array(COALESCE(area."geometryGeoJson", area."geoJson"))
        END
      ) AS feature(value)
      WHERE area.id = ${areaId}
        AND COALESCE(area."geometryGeoJson", area."geoJson") IS NOT NULL
    ) AS source
    WHERE area.id = ${areaId}
      AND source.geometry IS NOT NULL;
  `);
}
