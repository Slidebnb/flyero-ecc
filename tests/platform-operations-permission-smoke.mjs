import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const viewRoutes = [
  "src/app/api/admin/monitoring/route.ts",
  "src/app/api/admin/monitoring/errors/route.ts",
  "src/app/api/admin/monitoring/errors/[id]/route.ts",
  "src/app/api/admin/notifications/route.ts",
  "src/app/api/admin/notifications/queue/route.ts",
  "src/app/admin/notifications/page.tsx",
  "src/app/admin/notifications/queue/page.tsx",
];
const manageRoutes = [
  "src/app/api/admin/monitoring/health-check/route.ts",
  "src/app/api/admin/monitoring/errors/[id]/resolve/route.ts",
  "src/app/api/admin/monitoring/errors/[id]/ignore/route.ts",
  "src/app/api/admin/notifications/queue/process/route.ts",
  "src/app/api/admin/notifications/queue/[id]/retry/route.ts",
  "src/app/api/admin/notifications/test-email/route.ts",
];

async function assertPermission(filePath, permission) {
  const source = await readFile(filePath, "utf8");
  assert.match(source, new RegExp(`requirePermission\\(Permission\\.${permission}\\)`), `${filePath} fehlt ${permission}.`);
  assert.doesNotMatch(source, /SUPPORT_DISPATCHER/, `${filePath} erlaubt weiterhin globale Support-Operationen.`);
}

for (const filePath of viewRoutes) await assertPermission(filePath, filePath.includes("notifications") ? "NOTIFICATION_OPERATIONS_VIEW" : "MONITORING_VIEW");
for (const filePath of manageRoutes) await assertPermission(filePath, filePath.includes("notifications") ? "NOTIFICATION_OPERATIONS_MANAGE" : "MONITORING_MANAGE");

const permissions = await readFile("src/lib/permissions.ts", "utf8");
const matrix = await readFile("PERMISSION_MATRIX.md", "utf8");
for (const permission of ["MONITORING_VIEW", "MONITORING_MANAGE", "NOTIFICATION_OPERATIONS_VIEW", "NOTIFICATION_OPERATIONS_MANAGE"]) {
  assert.match(permissions, new RegExp(`${permission}:`), `${permission} fehlt.`);
}
for (const permission of ["monitoring.view", "monitoring.manage", "notification-operations.view", "notification-operations.manage"]) {
  assert(matrix.includes(`| \`${permission}\` | Ja | Nein`), `${permission} fehlt in der Matrix.`);
}

console.log("Platform-Operations-Permission-Smoke erfolgreich abgeschlossen.");
