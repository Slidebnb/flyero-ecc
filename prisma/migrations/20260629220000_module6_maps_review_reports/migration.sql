-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'DISTRIBUTION_APPROVED';
ALTER TYPE "OrderStatus" ADD VALUE 'REPORT_READY_PREVIEW';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TourStatus" ADD VALUE 'REJECTED';
ALTER TYPE "TourStatus" ADD VALUE 'NEEDS_CLARIFICATION';

-- AlterTable
ALTER TABLE "DistributionTour" ADD COLUMN     "adminCustomerMessage" TEXT,
ADD COLUMN     "adminInternalNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Report_tourId_key" ON "Report"("tourId");
