import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const paths = [
  "src/lib/retention.ts",
  "src/app/api/admin/retention-holds/route.ts",
  "src/app/api/admin/retention-holds/[id]/route.ts",
  "prisma/migrations/20260713170000_retention_holds/migration.sql",
];

for (const path of paths) {
  assert(await exists(path), `${path} fehlt.`);
}

const [schema, retention, collectionRoute, detailRoute, migration, packageJson] = await Promise.all([
  readFile("prisma/schema.prisma", "utf8"),
  readFile("src/lib/retention.ts", "utf8"),
  readFile("src/app/api/admin/retention-holds/route.ts", "utf8"),
  readFile("src/app/api/admin/retention-holds/[id]/route.ts", "utf8"),
  readFile("prisma/migrations/20260713170000_retention_holds/migration.sql", "utf8"),
  readFile("package.json", "utf8"),
]);

assert.match(schema, /model RetentionHold/);
assert.match(schema, /retentionHolds\s+RetentionHold\[\]/);
assert.match(retention, /activeRetentionHoldWhere/);
assert.match(retention, /releasedAt/);
assert.match(retention, /createAuditLog/);
assert.match(collectionRoute, /RETENTION_HOLD_MANAGE/);
assert.match(detailRoute, /RETENTION_HOLD_MANAGE/);
assert.match(detailRoute, /releasedAt/);
assert.match(migration, /CREATE TABLE "RetentionHold"/);
assert.match(migration, /tenantId/);
assert.match(packageJson, /test:retention-hold/);

console.log("Retention-Hold-Smoke erfolgreich abgeschlossen.");
