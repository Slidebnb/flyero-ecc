-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TourStatus" ADD VALUE 'READY';
ALTER TYPE "TourStatus" ADD VALUE 'PICKED_UP';
ALTER TYPE "TourStatus" ADD VALUE 'RESUMED';
ALTER TYPE "TourStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "TourStatus" ADD VALUE 'APPROVED';

-- AlterTable
ALTER TABLE "DistributionTour" ADD COLUMN     "endTime" TIMESTAMP(3),
ADD COLUMN     "inventoryId" TEXT,
ADD COLUMN     "pauseTime" TIMESTAMP(3),
ADD COLUMN     "pickupTime" TIMESTAMP(3),
ADD COLUMN     "startTime" TIMESTAMP(3),
ADD COLUMN     "totalDistanceMeters" INTEGER,
ADD COLUMN     "totalDurationSeconds" INTEGER,
ADD COLUMN     "totalPauseSeconds" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GpsPoint" ADD COLUMN     "altitude" DECIMAL(10,2),
ADD COLUMN     "battery" INTEGER,
ADD COLUMN     "flags" JSONB,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'browser',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ok';

-- AlterTable
ALTER TABLE "PhotoProof" ADD COLUMN     "accuracy" DECIMAL(8,2),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'camera';

-- CreateIndex
CREATE INDEX "DistributionTour_inventoryId_status_idx" ON "DistributionTour"("inventoryId", "status");

-- AddForeignKey
ALTER TABLE "DistributionTour" ADD CONSTRAINT "DistributionTour_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "WarehouseInventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
