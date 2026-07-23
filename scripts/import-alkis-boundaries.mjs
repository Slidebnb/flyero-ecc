import { readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const sourcePath = process.argv.slice(2).find((value) => !value.startsWith("--"));
const apply = process.argv.includes("--apply");
const sourceUrl = process.env.AREA_IMPORT_SOURCE_URL ?? "https://metadaten.geoportal-bw.de/geonetwork/srv/api/records/bdcf4b31-4087-e7f6-3fd6-f9e66b404203/formatters/xsl-view?output=pdf&language=ger&approved=true";
const sourceName = process.env.AREA_IMPORT_SOURCE_NAME ?? "ALKIS Verwaltungsgrenzen NOrA Januar 2026";
const licenseNote = process.env.AREA_IMPORT_LICENSE_NOTE ?? "Amtliche Verwaltungsgrenzen ALKIS/NOrA, Stand Januar 2026. Vor Nutzung die GOVDATA-Datenlizenz Deutschland beachten.";

if (!sourcePath) throw new Error("Verwendung: node scripts/import-alkis-boundaries.mjs <WGS84-GeoJSON> [--apply]");

function readGeoJson(filePath) {
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  if (parsed?.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    throw new Error("Die Datei muss eine GeoJSON FeatureCollection enthalten.");
  }
  return parsed;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function propertiesOf(feature) {
  return feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
}

function polygonFeatures(feature) {
  const geometry = feature?.geometry;
  if (!geometry || typeof geometry !== "object") return [];
  if (geometry.type === "Polygon") return [{ type: "Feature", properties: propertiesOf(feature), geometry }];
  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.map((coordinates) => ({
      type: "Feature",
      properties: propertiesOf(feature),
      geometry: { type: "Polygon", coordinates },
    }));
  }
  return [];
}

function validRing(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return false;
  return ring.every((point) => Array.isArray(point) && point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])));
}

function normalizeFeatureCollection(features) {
  const normalized = features.flatMap(polygonFeatures).filter((feature) => validRing(feature.geometry.coordinates?.[0]));
  if (!normalized.length) throw new Error("Keine gültigen Polygonflächen gefunden. Ist das GeoJSON in EPSG:4326?");
  return { type: "FeatureCollection", features: normalized };
}

function areaSqm(geometry) {
  const metersPerDegree = 111_320;
  return geometry.features.reduce((sum, feature) => {
    const ring = feature.geometry.coordinates[0];
    const averageLatitude = ring.reduce((total, point) => total + Number(point[1]), 0) / ring.length;
    const metersPerLongitudeDegree = Math.cos((averageLatitude * Math.PI) / 180) * metersPerDegree;
    let area = 0;
    for (let index = 0; index < ring.length - 1; index += 1) {
      const [lngA, latA] = ring[index].map(Number);
      const [lngB, latB] = ring[index + 1].map(Number);
      area += lngA * metersPerLongitudeDegree * (latB * metersPerDegree) - lngB * metersPerLongitudeDegree * (latA * metersPerDegree);
    }
    return sum + Math.abs(area / 2);
  }, 0);
}

function slugify(value) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}

function readRows(featureCollection) {
  return featureCollection.features.flatMap((rawFeature, index) => {
    const props = propertiesOf(rawFeature);
    const name = text(
      props.gemeinde_n
      ?? props.GEN_G
      ?? props.gemeinde_name
      ?? props.GeografischerName_GEN
      ?? props.name
      ?? props.city,
    );
    if (!name) throw new Error(`Feature ${index + 1} enthält keinen Gemeindenamen.`);
    const geometry = normalizeFeatureCollection([rawFeature]);
    const stableId = text(
      props.gml_id
      ?? props.AGS_G
      ?? props.gemeinde_i
      ?? props.Gemeindeschlüssel_AGS
      ?? props.GemeindeschlüsselAufgefüllt
      ?? props.Objektidentifikator
      ?? props.id,
    ) ?? `${name}-${index + 1}`;
    return [{
      slug: `alkis-gemeinde-${slugify(stableId)}`,
      name,
      city: name,
      postalCode: text(props.postalCode ?? props.postleitzahl ?? props.plz),
      district: text(props.kreis_name ?? props.Kreis ?? props.district),
      state: text(props.bundesland ?? props.Land ?? props.state),
      geometry,
      coverageAreaSqm: Math.round(areaSqm(geometry)),
    }];
  });
}

async function applyRows(rows) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL fehlt.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    for (const row of rows) {
      const area = await prisma.distributionArea.upsert({
        where: { slug: row.slug },
        update: {
          name: row.name,
          type: "CITY",
          city: row.city,
          postalCode: row.postalCode,
          district: row.district,
          state: row.state,
          country: "DE",
          geoJson: row.geometry,
          geometryGeoJson: row.geometry,
          coverageAreaSqm: row.coverageAreaSqm,
          areaKm2: row.coverageAreaSqm / 1_000_000,
          estimatedHouseholds: null,
          estimatedFlyers: null,
          estimatedDistanceMeters: null,
          googleFeatureType: "LOCALITY",
          dataSourceName: sourceName,
          dataSourceType: "OFFICIAL",
          dataSourceUrl: sourceUrl,
          licenseNote,
          dataUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
          confidence: 1,
          reusable: true,
        },
        create: {
          slug: row.slug,
          name: row.name,
          type: "CITY",
          city: row.city,
          postalCode: row.postalCode,
          district: row.district,
          state: row.state,
          country: "DE",
          geoJson: row.geometry,
          geometryGeoJson: row.geometry,
          coverageAreaSqm: row.coverageAreaSqm,
          areaKm2: row.coverageAreaSqm / 1_000_000,
          googleFeatureType: "LOCALITY",
          dataSourceName: sourceName,
          dataSourceType: "OFFICIAL",
          dataSourceUrl: sourceUrl,
          licenseNote,
          dataUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
          confidence: 1,
          reusable: true,
        },
      });
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "DistributionArea" AS area
        SET "spatialGeometry" = source.geometry
        FROM (
          SELECT ST_Multi(ST_CollectionExtract(ST_UnaryUnion(ST_Collect(
            ST_SetSRID(ST_GeomFromGeoJSON((feature.value -> 'geometry')::text), 4326)
          )), 3)) AS geometry
          FROM jsonb_array_elements(${JSON.stringify(row.geometry)}::jsonb -> 'features') AS feature(value)
        ) AS source
        WHERE area.id = ${area.id} AND source.geometry IS NOT NULL;
      `);
    }
  } finally {
    await prisma.$disconnect();
  }
}

const rows = readRows(readGeoJson(sourcePath));
if (apply) {
  await applyRows(rows);
  console.log(`ALKIS-Gemeindegrenzen importiert: ${rows.length}`);
} else {
  console.log(`ALKIS-GeoJSON validiert: ${rows.length} Gemeindegrenzen. Keine DB-Schreiboperation ohne --apply.`);
}
