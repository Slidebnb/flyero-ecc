-- CreateEnum
CREATE TYPE "PaymentDisputeStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'CLOSED');

-- DropIndex
DROP INDEX "CustomerProfile_tenantId_idx";

-- DropIndex
DROP INDEX "User_tenantId_idx";

-- CreateTable
CREATE TABLE "PaymentDispute" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "orderId" TEXT,
    "customerId" TEXT,
    "tenantId" TEXT,
    "stripeDisputeId" TEXT NOT NULL,
    "stripeChargeId" TEXT,
    "stripePaymentIntentId" TEXT,
    "status" "PaymentDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "amount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "dueBy" TIMESTAMP(3),
    "evidenceSubmittedAt" TIMESTAMP(3),
    "lastEventType" TEXT NOT NULL,
    "lastEventAt" TIMESTAMP(3) NOT NULL,
    "adminNote" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentDispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentDispute_stripeDisputeId_key" ON "PaymentDispute"("stripeDisputeId");

-- CreateIndex
CREATE INDEX "PaymentDispute_paymentId_status_idx" ON "PaymentDispute"("paymentId", "status");

-- CreateIndex
CREATE INDEX "PaymentDispute_tenantId_status_updatedAt_idx" ON "PaymentDispute"("tenantId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "PaymentDispute_orderId_status_idx" ON "PaymentDispute"("orderId", "status");

-- CreateIndex
CREATE INDEX "PaymentDispute_status_dueBy_idx" ON "PaymentDispute"("status", "dueBy");

-- AddForeignKey
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
