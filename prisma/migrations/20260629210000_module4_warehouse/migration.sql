-- CreateEnum
CREATE TYPE "WarehouseInventoryStatus" AS ENUM ('FLYERS_EXPECTED', 'FLYERS_RECEIVED', 'STORED', 'READY_FOR_PICKUP', 'PICKED_UP', 'RETURNED');

-- CreateEnum
CREATE TYPE "RemainingStockStatus" AS ENUM ('NOT_RELEVANT', 'ALLE_VERTEILT', 'RESTBESTAND', 'ENTSORGT', 'RUECKVERSAND');

-- CreateEnum
CREATE TYPE "PickupStatus" AS ENUM ('NOT_PREPARED', 'PREPARED', 'RESERVED', 'PICKED_UP', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'FLYERS_EXPECTED';
ALTER TYPE "OrderStatus" ADD VALUE 'FLYERS_RECEIVED';
ALTER TYPE "OrderStatus" ADD VALUE 'STORED';
ALTER TYPE "OrderStatus" ADD VALUE 'READY_FOR_PICKUP';

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "calculatedGrossPrice" DROP DEFAULT,
ALTER COLUMN "calculatedNetPrice" DROP DEFAULT,
ALTER COLUMN "calculatedVat" DROP DEFAULT,
ALTER COLUMN "postalCode" DROP DEFAULT,
ALTER COLUMN "preferredEndDate" DROP DEFAULT,
ALTER COLUMN "preferredStartDate" DROP DEFAULT,
ALTER COLUMN "priceRuleSnapshot" DROP DEFAULT,
ALTER COLUMN "targetAreaName" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "aisle" TEXT NOT NULL,
    "shelf" TEXT NOT NULL,
    "compartment" TEXT NOT NULL,
    "fullLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseInventory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "warehouseLocationId" TEXT,
    "status" "WarehouseInventoryStatus" NOT NULL DEFAULT 'FLYERS_EXPECTED',
    "remainingStockStatus" "RemainingStockStatus" NOT NULL DEFAULT 'NOT_RELEVANT',
    "qrCode" TEXT NOT NULL,
    "qrCodePngDataUrl" TEXT,
    "cartonCount" INTEGER,
    "expectedFlyers" INTEGER NOT NULL,
    "receivedFlyers" INTEGER,
    "remainingFlyers" INTEGER,
    "damagedFlyers" INTEGER,
    "weightOptional" DECIMAL(10,2),
    "notes" TEXT,
    "pickupToken" TEXT NOT NULL,
    "pickupStatus" "PickupStatus" NOT NULL DEFAULT 'NOT_PREPARED',
    "reservedDistributorId" TEXT,
    "preparedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseHistory" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Warehouse_city_idx" ON "Warehouse"("city");

-- CreateIndex
CREATE INDEX "WarehouseLocation_fullLabel_idx" ON "WarehouseLocation"("fullLabel");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_warehouseId_fullLabel_key" ON "WarehouseLocation"("warehouseId", "fullLabel");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseInventory_orderId_key" ON "WarehouseInventory"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseInventory_qrCode_key" ON "WarehouseInventory"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseInventory_pickupToken_key" ON "WarehouseInventory"("pickupToken");

-- CreateIndex
CREATE INDEX "WarehouseInventory_status_idx" ON "WarehouseInventory"("status");

-- CreateIndex
CREATE INDEX "WarehouseInventory_warehouseLocationId_idx" ON "WarehouseInventory"("warehouseLocationId");

-- CreateIndex
CREATE INDEX "WarehouseInventory_pickupStatus_idx" ON "WarehouseInventory"("pickupStatus");

-- CreateIndex
CREATE INDEX "WarehouseInventory_reservedDistributorId_idx" ON "WarehouseInventory"("reservedDistributorId");

-- CreateIndex
CREATE INDEX "WarehouseHistory_inventoryId_createdAt_idx" ON "WarehouseHistory"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "WarehouseHistory_userId_createdAt_idx" ON "WarehouseHistory"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseInventory" ADD CONSTRAINT "WarehouseInventory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseInventory" ADD CONSTRAINT "WarehouseInventory_warehouseLocationId_fkey" FOREIGN KEY ("warehouseLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseInventory" ADD CONSTRAINT "WarehouseInventory_reservedDistributorId_fkey" FOREIGN KEY ("reservedDistributorId") REFERENCES "DistributorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseHistory" ADD CONSTRAINT "WarehouseHistory_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "WarehouseInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseHistory" ADD CONSTRAINT "WarehouseHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
