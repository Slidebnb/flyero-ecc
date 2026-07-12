-- Establishes the first explicit tenant boundary for internal operator accounts.
INSERT INTO "Tenant" ("id", "name", "slug", "status", "createdAt", "updatedAt")
VALUES ('tenant_flyero_internal', 'FLYERO Betrieb', 'flyero-internal', 'ACTIVE', NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET "updatedAt" = NOW();

UPDATE "User"
SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'flyero-internal')
WHERE "role" IN ('SUPPORT_DISPATCHER', 'WAREHOUSE_STAFF')
  AND "tenantId" IS NULL;

INSERT INTO "TenantMembership" ("id", "tenantId", "userId", "role", "status", "createdAt", "updatedAt")
SELECT
  'membership_' || u."id",
  u."tenantId",
  u."id",
  CASE WHEN u."role" = 'WAREHOUSE_STAFF' THEN 'WAREHOUSE'::"TenantRole" ELSE 'SUPPORT'::"TenantRole" END,
  'ACTIVE'::"TenantMembershipStatus",
  NOW(),
  NOW()
FROM "User" u
WHERE u."role" IN ('SUPPORT_DISPATCHER', 'WAREHOUSE_STAFF')
  AND u."tenantId" IS NOT NULL
ON CONFLICT ("tenantId", "userId") DO UPDATE
SET "role" = EXCLUDED."role", "status" = 'ACTIVE'::"TenantMembershipStatus", "updatedAt" = NOW();
