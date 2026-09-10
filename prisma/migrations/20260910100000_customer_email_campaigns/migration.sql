CREATE TABLE "CustomerEmailCampaign" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "tenantId" TEXT,
    "createdById" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "couponCode" TEXT NOT NULL,
    "campaignUrl" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "queuedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerEmailCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerEmailCampaign_idempotencyKey_key" ON "CustomerEmailCampaign"("idempotencyKey");
CREATE INDEX "CustomerEmailCampaign_tenantId_createdAt_idx" ON "CustomerEmailCampaign"("tenantId", "createdAt");
CREATE INDEX "CustomerEmailCampaign_createdById_createdAt_idx" ON "CustomerEmailCampaign"("createdById", "createdAt");
ALTER TABLE "CustomerEmailCampaign" ADD CONSTRAINT "CustomerEmailCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerEmailCampaign" ADD CONSTRAINT "CustomerEmailCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
