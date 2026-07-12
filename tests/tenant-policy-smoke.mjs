import assert from "node:assert/strict";
import fs from "node:fs";
import { allowedTenantRolesForUserRole, tenantScopeMatches } from "../src/lib/tenantPolicyLogic.ts";

assert.deepEqual(allowedTenantRolesForUserRole("SUPPORT_DISPATCHER"), ["SUPPORT", "DISPATCHER", "OWNER", "ADMIN"]);
assert.deepEqual(allowedTenantRolesForUserRole("WAREHOUSE_STAFF"), ["WAREHOUSE", "OWNER", "ADMIN"]);
assert.deepEqual(allowedTenantRolesForUserRole("CUSTOMER"), ["OWNER", "ADMIN"]);
assert.equal(tenantScopeMatches({ role: "SUPPORT_DISPATCHER", tenantId: "tenant-a" }, "tenant-a"), true);
assert.equal(tenantScopeMatches({ role: "SUPPORT_DISPATCHER", tenantId: "tenant-a" }, "tenant-b"), false);
assert.equal(tenantScopeMatches({ role: "ADMIN", tenantId: null }, "tenant-b"), true);

const permissions = fs.readFileSync("src/lib/permissions.ts", "utf8");
assert.match(permissions, /requireActiveTenantMembership/);
assert.match(fs.readFileSync("src/app/api/admin/reports/route.ts", "utf8"), /tenantWhereForSession/);
assert.match(fs.readFileSync("src/app/api/admin/documents/route.ts", "utf8"), /DOCUMENT_REVIEW/);
assert.match(fs.readFileSync("prisma/schema.prisma", "utf8"), /model TenantMembership\s*\{/);
assert.match(fs.readFileSync("prisma/migrations/20260712222000_internal_tenant_memberships/migration.sql", "utf8"), /flyero-internal/);
assert.match(fs.readFileSync("prisma/seed.mjs", "utf8"), /flyero-internal/);

console.log("Tenant policy smoke checks passed.");
