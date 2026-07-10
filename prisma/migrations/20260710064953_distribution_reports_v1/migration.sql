-- CreateEnum
CREATE TYPE "InternalReviewStatus" AS ENUM ('NOT_REVIEWED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_CORRECTION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportStatus" ADD VALUE 'DATA_INCOMPLETE';
ALTER TYPE "ReportStatus" ADD VALUE 'READY_FOR_REVIEW';
ALTER TYPE "ReportStatus" ADD VALUE 'IN_REVIEW';
ALTER TYPE "ReportStatus" ADD VALUE 'CHANGES_REQUIRED';

-- AlterEnum
ALTER TYPE "TourStatus" ADD VALUE 'PLANNED';

-- DropIndex
DROP INDEX "Warehouse_city_idx";

-- AlterTable
ALTER TABLE "DistributionTour" ADD COLUMN     "actualAreaGeometry" JSONB,
ADD COLUMN     "actualDistanceKm" DECIMAL(10,2),
ADD COLUMN     "actualDurationMinutes" INTEGER,
ADD COLUMN     "actualRouteGeometry" JSONB,
ADD COLUMN     "assignedFlyerQuantity" INTEGER,
ADD COLUMN     "damagedFlyerQuantity" INTEGER,
ADD COLUMN     "deliveredFlyerQuantity" INTEGER,
ADD COLUMN     "gpsPointCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gpsQualityScore" INTEGER,
ADD COLUMN     "lastLocationAt" TIMESTAMP(3),
ADD COLUMN     "plannedAreaGeometry" JSONB,
ADD COLUMN     "plannedDistanceKm" DECIMAL(10,2),
ADD COLUMN     "plannedDurationMinutes" INTEGER,
ADD COLUMN     "plannedFlyerQuantity" INTEGER,
ADD COLUMN     "returnedFlyerQuantity" INTEGER,
ADD COLUMN     "unexplainedFlyerDifference" INTEGER;

-- AlterTable
ALTER TABLE "GpsPoint" ADD COLUMN     "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "suspicious" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PhotoProof" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'DISTRIBUTION_AREA',
ADD COLUMN     "customerVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deviceTimestamp" TIMESTAMP(3),
ADD COLUMN     "internalNote" TEXT,
ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "actualAreaGeometry" JSONB,
ADD COLUMN     "actualCompletedAt" TIMESTAMP(3),
ADD COLUMN     "actualCoveragePercent" DECIMAL(5,2),
ADD COLUMN     "actualDistanceKm" DECIMAL(10,2),
ADD COLUMN     "actualDurationMinutes" INTEGER,
ADD COLUMN     "actualRouteGeometry" JSONB,
ADD COLUMN     "actualStartedAt" TIMESTAMP(3),
ADD COLUMN     "areaCoveragePercent" DECIMAL(5,2),
ADD COLUMN     "calculationVersion" TEXT,
ADD COLUMN     "coverageMode" TEXT,
ADD COLUMN     "deliveredFlyerQuantity" INTEGER,
ADD COLUMN     "deviationSummary" TEXT,
ADD COLUMN     "distributorCount" INTEGER,
ADD COLUMN     "estimatedReachedHouseholds" INTEGER,
ADD COLUMN     "flyerCoveragePercent" DECIMAL(5,2),
ADD COLUMN     "householdCoverageEstimate" DECIMAL(5,2),
ADD COLUMN     "internalReviewStatus" "InternalReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
ADD COLUMN     "plannedAreaGeometry" JSONB,
ADD COLUMN     "plannedCoveragePercent" DECIMAL(5,2),
ADD COLUMN     "plannedDistanceKm" DECIMAL(10,2),
ADD COLUMN     "plannedDurationMinutes" INTEGER,
ADD COLUMN     "plannedFlyerQuantity" INTEGER,
ADD COLUMN     "plannedHouseholdCount" INTEGER,
ADD COLUMN     "plannedStartDate" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "remainingFlyerQuantity" INTEGER,
ADD COLUMN     "reportSnapshot" JSONB,
ADD COLUMN     "reportVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "summary" TEXT;

-- CreateTable
CREATE TABLE "DistributionDeviation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tourId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "description" TEXT NOT NULL,
    "affectedAreaGeometry" JSONB,
    "affectedFlyerQuantity" INTEGER,
    "customerVisible" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DistributionDeviation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DistributionDeviation_orderId_customerVisible_idx" ON "DistributionDeviation"("orderId", "customerVisible");

-- CreateIndex
CREATE INDEX "DistributionDeviation_tourId_idx" ON "DistributionDeviation"("tourId");

-- CreateIndex
CREATE INDEX "DistributionDeviation_type_severity_idx" ON "DistributionDeviation"("type", "severity");

-- RenameForeignKey
ALTER TABLE "Report" RENAME CONSTRAINT "Report_approvedBy_fkey" TO "Report_approvedById_fkey";

-- AddForeignKey
ALTER TABLE "DistributionDeviation" ADD CONSTRAINT "DistributionDeviation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionDeviation" ADD CONSTRAINT "DistributionDeviation_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "DistributionTour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
