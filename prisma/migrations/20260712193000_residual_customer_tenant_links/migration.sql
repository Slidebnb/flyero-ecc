ALTER TABLE "OrderExperienceEvent" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "DistributionArea" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN "tenantId" TEXT;

UPDATE "OrderExperienceEvent" AS event
SET "tenantId" = profile."tenantId"
FROM "CustomerProfile" AS profile
WHERE event."customerId" = profile."id"
  AND event."tenantId" IS NULL;

UPDATE "DistributionArea" AS area
SET "tenantId" = profile."tenantId"
FROM "CustomerProfile" AS profile
WHERE area."customerId" = profile."id"
  AND area."tenantId" IS NULL;

UPDATE "SupportTicket" AS ticket
SET "tenantId" = profile."tenantId"
FROM "CustomerProfile" AS profile
WHERE ticket."customerId" = profile."id"
  AND ticket."tenantId" IS NULL;

UPDATE "SupportTicket" AS ticket
SET "tenantId" = order_row."tenantId"
FROM "Order" AS order_row
WHERE ticket."orderId" = order_row."id"
  AND ticket."tenantId" IS NULL;

CREATE INDEX "OrderExperienceEvent_tenantId_createdAt_idx" ON "OrderExperienceEvent"("tenantId", "createdAt");
CREATE INDEX "DistributionArea_tenantId_status_idx" ON "DistributionArea"("tenantId", "status");
CREATE INDEX "SupportTicket_tenantId_status_idx" ON "SupportTicket"("tenantId", "status");

ALTER TABLE "OrderExperienceEvent"
  ADD CONSTRAINT "OrderExperienceEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DistributionArea"
  ADD CONSTRAINT "DistributionArea_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
