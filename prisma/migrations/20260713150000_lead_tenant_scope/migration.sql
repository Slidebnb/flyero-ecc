ALTER TABLE "Lead" ADD COLUMN "tenantId" TEXT;

CREATE INDEX "Lead_tenantId_status_createdAt_idx" ON "Lead"("tenantId", "status", "createdAt");

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
