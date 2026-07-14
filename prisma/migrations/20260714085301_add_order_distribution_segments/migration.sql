-- AlterTable
ALTER TABLE "DistributionTour" ADD COLUMN     "segmentId" TEXT;

-- CreateTable
CREATE TABLE "OrderDistributionSegment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "distributionAreaId" TEXT,
    "assignedWarehouseId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "postalCode" TEXT,
    "district" TEXT,
    "country" TEXT NOT NULL DEFAULT 'DE',
    "geometryGeoJson" JSONB NOT NULL,
    "centerLat" DECIMAL(10,7),
    "centerLng" DECIMAL(10,7),
    "areaSqm" DECIMAL(14,2) NOT NULL,
    "estimatedHouseholds" INTEGER,
    "flyerQuantity" INTEGER,
    "dataSource" TEXT,
    "dataSourceType" "AreaDataSourceType" NOT NULL DEFAULT 'ESTIMATED',
    "confidence" DECIMAL(4,3),
    "warehouseMatchStatus" TEXT NOT NULL DEFAULT 'MANUAL_REVIEW',
    "warehouseAssignmentReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderDistributionSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderDistributionSegment_orderId_sortOrder_idx" ON "OrderDistributionSegment"("orderId", "sortOrder");

-- CreateIndex
CREATE INDEX "OrderDistributionSegment_distributionAreaId_idx" ON "OrderDistributionSegment"("distributionAreaId");

-- CreateIndex
CREATE INDEX "OrderDistributionSegment_assignedWarehouseId_warehouseMatch_idx" ON "OrderDistributionSegment"("assignedWarehouseId", "warehouseMatchStatus");

-- CreateIndex
CREATE INDEX "OrderDistributionSegment_city_postalCode_idx" ON "OrderDistributionSegment"("city", "postalCode");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDistributionSegment_orderId_sortOrder_key" ON "OrderDistributionSegment"("orderId", "sortOrder");

-- CreateIndex
CREATE INDEX "DistributionTour_segmentId_status_idx" ON "DistributionTour"("segmentId", "status");

-- AddForeignKey
ALTER TABLE "OrderDistributionSegment" ADD CONSTRAINT "OrderDistributionSegment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDistributionSegment" ADD CONSTRAINT "OrderDistributionSegment_distributionAreaId_fkey" FOREIGN KEY ("distributionAreaId") REFERENCES "DistributionArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDistributionSegment" ADD CONSTRAINT "OrderDistributionSegment_assignedWarehouseId_fkey" FOREIGN KEY ("assignedWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionTour" ADD CONSTRAINT "DistributionTour_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "OrderDistributionSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
