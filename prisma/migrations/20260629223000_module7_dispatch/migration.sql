-- CreateEnum
CREATE TYPE "DispatchAssignmentStatus" AS ENUM ('ASSIGNED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'REASSIGNED');

-- CreateEnum
CREATE TYPE "DispatchRejectionReason" AS ENUM ('KEINE_ZEIT', 'KRANK', 'ZU_WEIT', 'SONSTIGES');

-- AlterTable
ALTER TABLE "DistributorProfile" ADD COLUMN     "availableToday" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "completedToursCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentAssignedFlyers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentAssignedTours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxFlyersPerDay" INTEGER NOT NULL DEFAULT 8000,
ADD COLUMN     "maxToursPerDay" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "rating" DECIMAL(3,2) NOT NULL DEFAULT 4.50;

-- CreateTable
CREATE TABLE "DispatchAssignment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "inventoryId" TEXT,
    "distributorId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "status" "DispatchAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "rejectionReason" "DispatchRejectionReason",
    "rejectionNote" TEXT,
    "capacityWarning" BOOLEAN NOT NULL DEFAULT false,
    "recommendationScore" INTEGER,
    "distanceMeters" INTEGER,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DistributorProfile_reviewStatus_availableToday_idx" ON "DistributorProfile"("reviewStatus", "availableToday");

-- CreateIndex
CREATE INDEX "DispatchAssignment_orderId_status_idx" ON "DispatchAssignment"("orderId", "status");

-- CreateIndex
CREATE INDEX "DispatchAssignment_inventoryId_status_idx" ON "DispatchAssignment"("inventoryId", "status");

-- CreateIndex
CREATE INDEX "DispatchAssignment_distributorId_status_idx" ON "DispatchAssignment"("distributorId", "status");

-- CreateIndex
CREATE INDEX "DispatchAssignment_assignedBy_assignedAt_idx" ON "DispatchAssignment"("assignedBy", "assignedAt");

-- CreateIndex
CREATE INDEX "DispatchAssignment_assignedAt_idx" ON "DispatchAssignment"("assignedAt");

-- AddForeignKey
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "WarehouseInventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "DistributorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchAssignment" ADD CONSTRAINT "DispatchAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
