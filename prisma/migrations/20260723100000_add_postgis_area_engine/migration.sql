-- FLYERO-owned area engine: Google remains the visual map, PostGIS owns spatial selection.
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "DistributionArea"
  ADD COLUMN IF NOT EXISTS "spatialGeometry" geometry(Geometry, 4326);

CREATE INDEX IF NOT EXISTS "DistributionArea_spatialGeometry_gist_idx"
  ON "DistributionArea" USING GIST ("spatialGeometry");

-- Backfill existing GeoJSON records without inventing or changing business data.
-- FeatureCollections are reduced to their polygon geometries and normalized to WGS84.
UPDATE "DistributionArea" AS area
SET "spatialGeometry" = source.geometry
FROM (
  SELECT
    candidate.id,
    ST_Multi(
      ST_CollectionExtract(
        ST_UnaryUnion(ST_Collect(candidate.part)),
        3
      )
    ) AS geometry
  FROM (
    SELECT
      area.id,
      ST_SetSRID(
        ST_GeomFromGeoJSON(
          (CASE
            WHEN jsonb_typeof(feature.value -> 'geometry') = 'object' THEN feature.value -> 'geometry'
            ELSE feature.value
          END)::text
        ),
        4326
      ) AS part
    FROM "DistributionArea" AS area
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(COALESCE(area."geometryGeoJson", area."geoJson") -> 'features') = 'array'
          THEN COALESCE(area."geometryGeoJson", area."geoJson") -> 'features'
        ELSE jsonb_build_array(COALESCE(area."geometryGeoJson", area."geoJson"))
      END
    ) AS feature(value)
    WHERE COALESCE(area."geometryGeoJson", area."geoJson") IS NOT NULL
      AND jsonb_typeof(feature.value -> 'geometry') = 'object'
  ) AS candidate
  GROUP BY candidate.id
) AS source
WHERE area.id = source.id
  AND source.geometry IS NOT NULL;
