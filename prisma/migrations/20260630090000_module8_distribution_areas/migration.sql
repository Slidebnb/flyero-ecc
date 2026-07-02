-- CreateEnum
CREATE TYPE "DistributionAreaType" AS ENUM ('POSTAL_CODE', 'CITY', 'DISTRICT', 'POLYGON', 'RADIUS');

-- CreateEnum
CREATE TYPE "DistributionAreaStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "HouseholdEstimateMethod" AS ENUM ('MANUAL', 'SEED', 'IMPORT', 'AUTOMATIC');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "coverageAreaSqm" DECIMAL(14,2),
ADD COLUMN     "distributionAreaId" TEXT,
ADD COLUMN     "estimatedDistanceMeters" INTEGER,
ADD COLUMN     "estimatedFlyers" INTEGER;

-- CreateTable
CREATE TABLE "DistributionArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "DistributionAreaType" NOT NULL,
    "status" "DistributionAreaStatus" NOT NULL DEFAULT 'ACTIVE',
    "reusable" BOOLEAN NOT NULL DEFAULT true,
    "city" TEXT,
    "postalCode" TEXT,
    "district" TEXT,
    "centerLat" DECIMAL(10,7),
    "centerLng" DECIMAL(10,7),
    "radiusMeters" INTEGER,
    "geoJson" JSONB,
    "coverageAreaSqm" DECIMAL(14,2),
    "estimatedHouseholds" INTEGER,
    "estimatedFlyers" INTEGER,
    "estimatedDistanceMeters" INTEGER,
    "createdById" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributionArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaPolygon" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "geometry" JSONB NOT NULL,
    "areaSqm" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaPolygon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaHouseholdEstimate" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "households" INTEGER NOT NULL,
    "estimatedFlyers" INTEGER,
    "distanceMeters" INTEGER,
    "coverageAreaSqm" DECIMAL(14,2),
    "method" "HouseholdEstimateMethod" NOT NULL DEFAULT 'MANUAL',
    "source" TEXT,
    "confidence" DECIMAL(4,3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AreaHouseholdEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaHistory" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AreaHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DistributionArea_slug_key" ON "DistributionArea"("slug");

-- CreateIndex
CREATE INDEX "DistributionArea_type_status_idx" ON "DistributionArea"("type", "status");

-- CreateIndex
CREATE INDEX "DistributionArea_city_postalCode_idx" ON "DistributionArea"("city", "postalCode");

-- CreateIndex
CREATE INDEX "DistributionArea_customerId_status_idx" ON "DistributionArea"("customerId", "status");

-- CreateIndex
CREATE INDEX "DistributionArea_createdById_idx" ON "DistributionArea"("createdById");

-- CreateIndex
CREATE INDEX "AreaPolygon_areaId_sortOrder_idx" ON "AreaPolygon"("areaId", "sortOrder");

-- CreateIndex
CREATE INDEX "AreaHouseholdEstimate_areaId_createdAt_idx" ON "AreaHouseholdEstimate"("areaId", "createdAt");

-- CreateIndex
CREATE INDEX "AreaHouseholdEstimate_method_idx" ON "AreaHouseholdEstimate"("method");

-- CreateIndex
CREATE INDEX "AreaHistory_areaId_createdAt_idx" ON "AreaHistory"("areaId", "createdAt");

-- CreateIndex
CREATE INDEX "AreaHistory_userId_createdAt_idx" ON "AreaHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_distributionAreaId_idx" ON "Order"("distributionAreaId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_distributionAreaId_fkey" FOREIGN KEY ("distributionAreaId") REFERENCES "DistributionArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionArea" ADD CONSTRAINT "DistributionArea_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionArea" ADD CONSTRAINT "DistributionArea_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaPolygon" ADD CONSTRAINT "AreaPolygon_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "DistributionArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaHouseholdEstimate" ADD CONSTRAINT "AreaHouseholdEstimate_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "DistributionArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaHouseholdEstimate" ADD CONSTRAINT "AreaHouseholdEstimate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaHistory" ADD CONSTRAINT "AreaHistory_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "DistributionArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaHistory" ADD CONSTRAINT "AreaHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
