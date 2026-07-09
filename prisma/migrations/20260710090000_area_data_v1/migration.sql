-- Area data v1: source, license and import metadata for future official/ licensed household data imports.

ALTER TYPE "DistributionAreaType" ADD VALUE IF NOT EXISTS 'CUSTOM';
ALTER TYPE "DistributionAreaType" ADD VALUE IF NOT EXISTS 'DELIVERY_ZONE';

ALTER TYPE "HouseholdEstimateMethod" ADD VALUE IF NOT EXISTS 'ADMIN_ENTRY';
ALTER TYPE "HouseholdEstimateMethod" ADD VALUE IF NOT EXISTS 'OFFICIAL_IMPORT';
ALTER TYPE "HouseholdEstimateMethod" ADD VALUE IF NOT EXISTS 'LICENSED_IMPORT';
ALTER TYPE "HouseholdEstimateMethod" ADD VALUE IF NOT EXISTS 'AREA_INTERPOLATION';
ALTER TYPE "HouseholdEstimateMethod" ADD VALUE IF NOT EXISTS 'BUILDING_ESTIMATE';

CREATE TYPE "AreaDataSourceType" AS ENUM ('SEED', 'ADMIN', 'OFFICIAL', 'LICENSED', 'IMPORTED', 'ESTIMATED');

ALTER TABLE "DistributionArea"
ADD COLUMN "state" TEXT,
ADD COLUMN "country" TEXT NOT NULL DEFAULT 'DE',
ADD COLUMN "geometryGeoJson" JSONB,
ADD COLUMN "areaKm2" DECIMAL(12,6),
ADD COLUMN "googlePlaceId" TEXT,
ADD COLUMN "googleFeatureType" TEXT,
ADD COLUMN "dataSourceName" TEXT,
ADD COLUMN "dataSourceType" "AreaDataSourceType" NOT NULL DEFAULT 'SEED',
ADD COLUMN "dataSourceUrl" TEXT,
ADD COLUMN "licenseNote" TEXT,
ADD COLUMN "dataUpdatedAt" TIMESTAMP(3),
ADD COLUMN "confidence" DECIMAL(4,3);

ALTER TABLE "AreaHouseholdEstimate"
ADD COLUMN "estimatedHouseholds" INTEGER,
ADD COLUMN "estimatedResidents" INTEGER,
ADD COLUMN "estimatedDwellings" INTEGER,
ADD COLUMN "residentialBuildings" INTEGER,
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "sourceYear" INTEGER,
ADD COLUMN "notes" TEXT,
ADD COLUMN "validFrom" TIMESTAMP(3),
ADD COLUMN "validTo" TIMESTAMP(3);

UPDATE "DistributionArea"
SET
  "geometryGeoJson" = COALESCE("geometryGeoJson", "geoJson"),
  "areaKm2" = CASE
    WHEN "coverageAreaSqm" IS NOT NULL THEN ROUND(("coverageAreaSqm" / 1000000)::numeric, 6)
    ELSE "areaKm2"
  END,
  "dataSourceName" = COALESCE("dataSourceName", 'module8-seed'),
  "dataSourceType" = COALESCE("dataSourceType", 'SEED'),
  "dataUpdatedAt" = COALESCE("dataUpdatedAt", "updatedAt"),
  "confidence" = COALESCE("confidence", 0.700);

UPDATE "AreaHouseholdEstimate"
SET
  "estimatedHouseholds" = COALESCE("estimatedHouseholds", "households"),
  "sourceYear" = COALESCE("sourceYear", EXTRACT(YEAR FROM "createdAt")::integer),
  "validFrom" = COALESCE("validFrom", "createdAt");

CREATE INDEX "DistributionArea_dataSourceType_dataUpdatedAt_idx" ON "DistributionArea"("dataSourceType", "dataUpdatedAt");
CREATE INDEX "DistributionArea_googlePlaceId_idx" ON "DistributionArea"("googlePlaceId");
CREATE INDEX "AreaHouseholdEstimate_sourceYear_idx" ON "AreaHouseholdEstimate"("sourceYear");
CREATE INDEX "AreaHouseholdEstimate_validFrom_validTo_idx" ON "AreaHouseholdEstimate"("validFrom", "validTo");
