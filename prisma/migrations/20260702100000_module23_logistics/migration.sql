-- Module 23: Multi-Lager, Logistik und Supply Chain MVP

CREATE TYPE "ShipmentType" AS ENUM (
  'CUSTOMER_TO_WAREHOUSE',
  'PRINTER_TO_WAREHOUSE',
  'WAREHOUSE_TO_WAREHOUSE',
  'WAREHOUSE_TO_DISTRIBUTOR',
  'RETURN_TO_CUSTOMER',
  'DISPOSAL'
);

CREATE TYPE "ShipmentStatus" AS ENUM (
  'CREATED',
  'IN_TRANSIT',
  'DELIVERED',
  'RECEIVED',
  'DAMAGED',
  'LOST',
  'CANCELLED'
);

CREATE TYPE "TransferStatus" AS ENUM (
  'REQUESTED',
  'APPROVED',
  'IN_TRANSIT',
  'RECEIVED',
  'CANCELLED'
);

ALTER TABLE "Warehouse"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "country" TEXT NOT NULL DEFAULT 'DE',
  ADD COLUMN "latitude" DECIMAL(10,7),
  ADD COLUMN "longitude" DECIMAL(10,7),
  ADD COLUMN "region" TEXT,
  ADD COLUMN "capacityLimit" INTEGER,
  ADD COLUMN "currentUtilization" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "notes" TEXT;

UPDATE "Warehouse"
SET "code" = upper(regexp_replace(coalesce("city", 'warehouse'), '[^a-zA-Z0-9]+', '', 'g')) || '-' || substr("id", length("id") - 5, 6)
WHERE "code" IS NULL;

ALTER TABLE "Warehouse" ALTER COLUMN "code" SET NOT NULL;

ALTER TABLE "User" ADD COLUMN "warehouseId" TEXT;

ALTER TABLE "Order"
  ADD COLUMN "assignedWarehouseId" TEXT,
  ADD COLUMN "warehouseAssignedAt" TIMESTAMP(3),
  ADD COLUMN "warehouseAssignmentReason" TEXT;

ALTER TABLE "WarehouseInventory" ADD COLUMN "warehouseId" TEXT;

UPDATE "WarehouseInventory" wi
SET "warehouseId" = wl."warehouseId"
FROM "WarehouseLocation" wl
WHERE wi."warehouseLocationId" = wl."id";

UPDATE "WarehouseInventory" wi
SET "warehouseId" = w."id"
FROM "Warehouse" w
WHERE wi."warehouseId" IS NULL AND w."isDefault" = true;

ALTER TABLE "PrintOrder" ADD COLUMN "assignedWarehouseId" TEXT;

CREATE TABLE "WarehouseRegion" (
  "id" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT,
  "postalCodes" TEXT[],
  "radiusKm" INTEGER,
  "polygonGeoJson" JSONB,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WarehouseRegion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LogisticsShipment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "printOrderId" TEXT,
  "warehouseId" TEXT NOT NULL,
  "shipmentType" "ShipmentType" NOT NULL,
  "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
  "carrier" TEXT,
  "trackingNumber" TEXT,
  "senderName" TEXT,
  "senderAddress" JSONB,
  "recipientName" TEXT,
  "recipientAddress" JSONB,
  "expectedDeliveryDate" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "receivedById" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LogisticsShipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarehouseTransfer" (
  "id" TEXT NOT NULL,
  "fromWarehouseId" TEXT NOT NULL,
  "toWarehouseId" TEXT NOT NULL,
  "inventoryId" TEXT NOT NULL,
  "status" "TransferStatus" NOT NULL DEFAULT 'REQUESTED',
  "quantity" INTEGER NOT NULL,
  "requestedById" TEXT,
  "approvedById" TEXT,
  "shippedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WarehouseTransfer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarehouseStockCount" (
  "id" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "inventoryId" TEXT NOT NULL,
  "expectedQuantity" INTEGER NOT NULL,
  "countedQuantity" INTEGER NOT NULL,
  "difference" INTEGER NOT NULL,
  "countedById" TEXT,
  "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,

  CONSTRAINT "WarehouseStockCount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");
CREATE INDEX "Warehouse_city_postalCode_idx" ON "Warehouse"("city", "postalCode");
CREATE INDEX "Warehouse_code_idx" ON "Warehouse"("code");
CREATE INDEX "User_warehouseId_idx" ON "User"("warehouseId");
CREATE INDEX "Order_assignedWarehouseId_idx" ON "Order"("assignedWarehouseId");
CREATE INDEX "WarehouseInventory_warehouseId_idx" ON "WarehouseInventory"("warehouseId");
CREATE INDEX "PrintOrder_assignedWarehouseId_idx" ON "PrintOrder"("assignedWarehouseId");
CREATE INDEX "WarehouseRegion_warehouseId_isActive_idx" ON "WarehouseRegion"("warehouseId", "isActive");
CREATE INDEX "WarehouseRegion_city_idx" ON "WarehouseRegion"("city");
CREATE INDEX "WarehouseRegion_priority_idx" ON "WarehouseRegion"("priority");
CREATE INDEX "LogisticsShipment_orderId_status_idx" ON "LogisticsShipment"("orderId", "status");
CREATE INDEX "LogisticsShipment_printOrderId_idx" ON "LogisticsShipment"("printOrderId");
CREATE INDEX "LogisticsShipment_warehouseId_status_idx" ON "LogisticsShipment"("warehouseId", "status");
CREATE INDEX "LogisticsShipment_shipmentType_status_idx" ON "LogisticsShipment"("shipmentType", "status");
CREATE INDEX "LogisticsShipment_expectedDeliveryDate_idx" ON "LogisticsShipment"("expectedDeliveryDate");
CREATE INDEX "WarehouseTransfer_fromWarehouseId_status_idx" ON "WarehouseTransfer"("fromWarehouseId", "status");
CREATE INDEX "WarehouseTransfer_toWarehouseId_status_idx" ON "WarehouseTransfer"("toWarehouseId", "status");
CREATE INDEX "WarehouseTransfer_inventoryId_idx" ON "WarehouseTransfer"("inventoryId");
CREATE INDEX "WarehouseTransfer_requestedById_idx" ON "WarehouseTransfer"("requestedById");
CREATE INDEX "WarehouseStockCount_warehouseId_countedAt_idx" ON "WarehouseStockCount"("warehouseId", "countedAt");
CREATE INDEX "WarehouseStockCount_inventoryId_idx" ON "WarehouseStockCount"("inventoryId");
CREATE INDEX "WarehouseStockCount_countedById_idx" ON "WarehouseStockCount"("countedById");

ALTER TABLE "User" ADD CONSTRAINT "User_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_assignedWarehouseId_fkey" FOREIGN KEY ("assignedWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WarehouseInventory" ADD CONSTRAINT "WarehouseInventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrintOrder" ADD CONSTRAINT "PrintOrder_assignedWarehouseId_fkey" FOREIGN KEY ("assignedWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WarehouseRegion" ADD CONSTRAINT "WarehouseRegion_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogisticsShipment" ADD CONSTRAINT "LogisticsShipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogisticsShipment" ADD CONSTRAINT "LogisticsShipment_printOrderId_fkey" FOREIGN KEY ("printOrderId") REFERENCES "PrintOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LogisticsShipment" ADD CONSTRAINT "LogisticsShipment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogisticsShipment" ADD CONSTRAINT "LogisticsShipment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "WarehouseInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WarehouseStockCount" ADD CONSTRAINT "WarehouseStockCount_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarehouseStockCount" ADD CONSTRAINT "WarehouseStockCount_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "WarehouseInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarehouseStockCount" ADD CONSTRAINT "WarehouseStockCount_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
