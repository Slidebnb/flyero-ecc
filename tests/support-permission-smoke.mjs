import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [permissions, matrix, listRoute, detailRoute, messageRoute, closeRoute] = await Promise.all([
  readFile("src/lib/permissions.ts", "utf8"),
  readFile("PERMISSION_MATRIX.md", "utf8"),
  readFile("src/app/api/admin/support/tickets/route.ts", "utf8"),
  readFile("src/app/api/admin/support/tickets/[id]/route.ts", "utf8"),
  readFile("src/app/api/admin/support/tickets/[id]/message/route.ts", "utf8"),
  readFile("src/app/api/admin/support/tickets/[id]/close/route.ts", "utf8"),
]);
const support = await readFile("src/lib/support.ts", "utf8");

assert.match(permissions, /SUPPORT_TICKET_VIEW:/, "Support-Lesepermission fehlt.");
assert.match(permissions, /SUPPORT_TICKET_MANAGE:/, "Support-Mutationspermission fehlt.");
assert.match(matrix, /support\.ticket\.view/);
assert.match(matrix, /support\.ticket\.manage/);
assert.match(listRoute, /requirePermission\(Permission\.SUPPORT_TICKET_VIEW\)/);
assert.match(listRoute, /requirePermission\(Permission\.SUPPORT_TICKET_MANAGE\)/);
assert.match(detailRoute, /requirePermission\(Permission\.SUPPORT_TICKET_VIEW\)/);
assert.match(detailRoute, /requirePermission\(Permission\.SUPPORT_TICKET_MANAGE\)/);
assert.match(messageRoute, /requirePermission\(Permission\.SUPPORT_TICKET_MANAGE\)/);
assert.match(closeRoute, /requirePermission\(Permission\.SUPPORT_TICKET_MANAGE\)/);
assert.match(support, /isGlobalSupportAdmin/);
assert.match(support, /actor\.role === UserRole\.SUPPORT_DISPATCHER/);
assert.match(support, /return \{ tenantId: actor\.tenantId \}/);
assert.match(support, /findFirst\(\{\s*where: \{ id, \.\.\.scopeWhere\(actor\),/s);
assert.match(support, /Der Bezug gehoert nicht zu deinem Supportmandanten/);

console.log("Support permission smoke checks passed.");
