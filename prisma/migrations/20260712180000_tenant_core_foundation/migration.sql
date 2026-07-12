CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "TenantMembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'DISPATCHER', 'WAREHOUSE', 'DISTRIBUTOR', 'SUPPORT', 'ACCOUNTING', 'READ_ONLY');

CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL,
    "status" "TenantMembershipStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE UNIQUE INDEX "TenantMembership_tenantId_userId_key" ON "TenantMembership"("tenantId", "userId");
CREATE INDEX "Tenant_status_createdAt_idx" ON "Tenant"("status", "createdAt");
CREATE INDEX "TenantMembership_userId_status_idx" ON "TenantMembership"("userId", "status");
CREATE INDEX "TenantMembership_tenantId_role_status_idx" ON "TenantMembership"("tenantId", "role", "status");

ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "CustomerProfile" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Order" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Report" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Refund" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Document" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "PrintOrder" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "tenantId" TEXT;

INSERT INTO "Tenant" ("id", "name", "slug", "status", "createdAt", "updatedAt")
SELECT 'tenant_' || cp."id", cp."companyName", 'customer-' || cp."id", 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "CustomerProfile" cp;

UPDATE "CustomerProfile" cp
SET "tenantId" = t."id"
FROM "Tenant" t
WHERE t."slug" = 'customer-' || cp."id";

UPDATE "User" u
SET "tenantId" = cp."tenantId"
FROM "CustomerProfile" cp
WHERE cp."userId" = u."id";

UPDATE "Order" item
SET "tenantId" = cp."tenantId"
FROM "CustomerProfile" cp
WHERE cp."id" = item."customerId";

UPDATE "Report" item
SET "tenantId" = cp."tenantId"
FROM "CustomerProfile" cp
WHERE cp."id" = item."customerId";

UPDATE "Payment" item
SET "tenantId" = cp."tenantId"
FROM "CustomerProfile" cp
WHERE cp."id" = item."customerId";

UPDATE "Refund" item
SET "tenantId" = cp."tenantId"
FROM "CustomerProfile" cp
WHERE cp."id" = item."customerId";

UPDATE "Invoice" item
SET "tenantId" = cp."tenantId"
FROM "CustomerProfile" cp
WHERE cp."id" = item."customerId";

UPDATE "Document" item
SET "tenantId" = cp."tenantId"
FROM "CustomerProfile" cp
WHERE cp."id" = item."customerId";

UPDATE "PrintOrder" item
SET "tenantId" = cp."tenantId"
FROM "CustomerProfile" cp
WHERE cp."id" = item."customerId";

UPDATE "AuditLog" item
SET "tenantId" = u."tenantId"
FROM "User" u
WHERE item."userId" = u."id";

INSERT INTO "TenantMembership" ("id", "tenantId", "userId", "role", "status", "createdAt", "updatedAt")
SELECT 'membership_' || cp."id", cp."tenantId", cp."userId", 'OWNER', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "CustomerProfile" cp;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CustomerProfile" WHERE "tenantId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Order" WHERE "tenantId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Report" WHERE "tenantId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Payment" WHERE "tenantId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Refund" WHERE "tenantId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Invoice" WHERE "tenantId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Document" WHERE "tenantId" IS NULL)
    OR EXISTS (SELECT 1 FROM "PrintOrder" WHERE "tenantId" IS NULL)
  THEN
    RAISE EXCEPTION 'Tenant backfill incomplete; migration stopped before enforcing constraints';
  END IF;
END $$;

ALTER TABLE "CustomerProfile" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Report" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Refund" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Document" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "PrintOrder" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX "CustomerProfile_tenantId_idx" ON "CustomerProfile"("tenantId");
CREATE INDEX "Order_tenantId_status_createdAt_idx" ON "Order"("tenantId", "status", "createdAt");
CREATE INDEX "Report_tenantId_status_idx" ON "Report"("tenantId", "status");
CREATE INDEX "Payment_tenantId_status_idx" ON "Payment"("tenantId", "status");
CREATE INDEX "Refund_tenantId_status_idx" ON "Refund"("tenantId", "status");
CREATE INDEX "Invoice_tenantId_status_idx" ON "Invoice"("tenantId", "status");
CREATE INDEX "Document_tenantId_status_idx" ON "Document"("tenantId", "status");
CREATE INDEX "PrintOrder_tenantId_status_idx" ON "PrintOrder"("tenantId", "status");
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrintOrder" ADD CONSTRAINT "PrintOrder_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
