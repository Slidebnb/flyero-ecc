import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile("prisma/schema.prisma", "utf8");
const audit = await readFile("src/lib/audit.ts", "utf8");
const context = await readFile("src/lib/auditRequestContext.ts", "utf8");
const migration = await readFile("prisma/migrations/20260712160000_audit_log_context/migration.sql", "utf8");
const login = await readFile("src/app/api/auth/login/route.ts", "utf8");
const logout = await readFile("src/app/api/auth/logout/route.ts", "utf8");

for (const field of ["requestId", "ipAddress", "userAgent", "result"]) {
  assert.match(schema, new RegExp(`\\b${field}\\b`), `AuditLog field missing: ${field}`);
  assert.match(audit, new RegExp(`\\b${field}\\b`), `Audit writer field missing: ${field}`);
  assert.match(migration, new RegExp(`\\"${field}\\"`), `Migration field missing: ${field}`);
}

assert.match(context, /randomUUID/);
assert.match(context, /x-request-id/);
assert.match(context, /x-forwarded-for/);
assert.match(context, /slice\(0, MAX_USER_AGENT_LENGTH\)/);
assert.match(login, /auditRequestContext\(request\)/);
assert.match(logout, /auditRequestContext\(request\)/);
assert.doesNotMatch(context, /authorization|cookie/i);
assert.match(audit, /isForeignKeyViolation/);
assert.match(audit, /userId: null, tenantId: undefined/);

console.log("AuditLog v2 smoke checks passed.");
