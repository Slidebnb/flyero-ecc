-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('FLYER_DISTRIBUTION', 'DOOR_HANGER', 'BROCHURE', 'MAGAZINE');

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'WAITING_FOR_CUSTOMER', 'APPROVED', 'REJECTED', 'CANCELLED', 'READY_FOR_FLYERS');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING (
  CASE "status"::text
    WHEN 'REQUESTED' THEN 'SUBMITTED'
    WHEN 'CONFIRMED' THEN 'UNDER_REVIEW'
    WHEN 'AWAITING_FLYERS' THEN 'READY_FOR_FLYERS'
    WHEN 'FLYERS_IN_TRANSIT' THEN 'READY_FOR_FLYERS'
    WHEN 'FLYERS_RECEIVED' THEN 'READY_FOR_FLYERS'
    WHEN 'STORED' THEN 'READY_FOR_FLYERS'
    WHEN 'ASSIGNED_TO_DISTRIBUTOR' THEN 'READY_FOR_FLYERS'
    WHEN 'PICKUP_READY' THEN 'READY_FOR_FLYERS'
    WHEN 'PICKED_UP' THEN 'READY_FOR_FLYERS'
    WHEN 'DISTRIBUTION_STARTED' THEN 'READY_FOR_FLYERS'
    WHEN 'DISTRIBUTION_PAUSED' THEN 'READY_FOR_FLYERS'
    WHEN 'DISTRIBUTION_COMPLETED' THEN 'READY_FOR_FLYERS'
    WHEN 'REPORT_GENERATED' THEN 'READY_FOR_FLYERS'
    WHEN 'INVOICED' THEN 'READY_FOR_FLYERS'
    WHEN 'PAID' THEN 'READY_FOR_FLYERS'
    WHEN 'DISPUTED' THEN 'WAITING_FOR_CUSTOMER'
    ELSE "status"::text
  END::"OrderStatus_new"
);
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
COMMIT;

-- AlterTable
UPDATE "Order" SET "targetAddress" = '{}'::jsonb WHERE "targetAddress" IS NULL;
ALTER TABLE "Order" DROP COLUMN "adminPriceOverride",
DROP COLUMN "desiredEndDate",
DROP COLUMN "desiredStartDate",
DROP COLUMN "hasPrintedFlyers",
DROP COLUMN "householdEstimate",
DROP COLUMN "priceGross",
DROP COLUMN "priceNet",
DROP COLUMN "vatAmount",
ADD COLUMN     "adminCustomerMessage" TEXT,
ADD COLUMN     "adminInternalNotes" TEXT,
ADD COLUMN     "calculatedGrossPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "calculatedNetPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "calculatedVat" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "customerOwnFlyers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "estimatedHouseholds" INTEGER,
ADD COLUMN     "flexibleScheduling" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manualPriceOverride" DECIMAL(12,2),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "postalCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "preferredEndDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "preferredStartDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "priceRuleSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN     "serviceType" "ServiceType" NOT NULL DEFAULT 'FLYER_DISTRIBUTION',
ADD COLUMN     "targetAreaName" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "status" SET DEFAULT 'SUBMITTED',
ALTER COLUMN "targetAddress" SET NOT NULL;

-- CreateTable
CREATE TABLE "OrderStatusEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "changedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueDecimal" DECIMAL(12,4) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL DEFAULT 'FLYER_DISTRIBUTION',
    "minQuantity" INTEGER NOT NULL,
    "maxQuantity" INTEGER,
    "pricePerUnit" DECIMAL(12,4) NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "minimumNetPrice" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderStatusEvent_orderId_createdAt_idx" ON "OrderStatusEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderStatusEvent_changedBy_createdAt_idx" ON "OrderStatusEvent"("changedBy", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PricingSetting_key_key" ON "PricingSetting"("key");

-- CreateIndex
CREATE INDEX "PricingRule_serviceType_isActive_idx" ON "PricingRule"("serviceType", "isActive");

-- CreateIndex
CREATE INDEX "PricingRule_minQuantity_maxQuantity_idx" ON "PricingRule"("minQuantity", "maxQuantity");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_serviceType_idx" ON "Order"("serviceType");

-- AddForeignKey
ALTER TABLE "OrderStatusEvent" ADD CONSTRAINT "OrderStatusEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusEvent" ADD CONSTRAINT "OrderStatusEvent_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
