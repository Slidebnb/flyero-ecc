import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const permissionSource = await readFile("src/lib/permissions.ts", "utf8");
const matrix = await readFile("PERMISSION_MATRIX.md", "utf8");

for (const permission of [
  "DISTRIBUTOR_OPERATIONS_VIEW",
  "DISTRIBUTOR_OPERATIONS_MANAGE",
  "DISTRIBUTOR_SUPPORT_VIEW",
  "DISTRIBUTOR_SUPPORT_MANAGE",
]) {
  assert.match(permissionSource, new RegExp(`${permission}:`), `${permission} fehlt im zentralen Berechtigungssystem.`);
}
assert.match(permissionSource, /DISTRIBUTOR_RELATION_SCOPED_PERMISSIONS/, "Die Verteiler-Ausnahme ist nicht explizit dokumentiert.");
assert.match(permissionSource, /session\.role === UserRole\.DISTRIBUTOR/, "Die Verteiler-Ausnahme ist nicht auf die Verteilerrolle begrenzt.");

for (const permission of [
  "distributor.operations.view",
  "distributor.operations.manage",
  "distributor.support.view",
  "distributor.support.manage",
]) {
  assert(matrix.includes(`| \`${permission}\` | Ja | Nein`), `${permission} fehlt in der Berechtigungsmatrix.`);
}

const routePermissions = new Map([
  ["src/app/api/distributor/available-orders/route.ts", "DISTRIBUTOR_OPERATIONS_VIEW"],
  ["src/app/api/distributor/notifications/route.ts", "DISTRIBUTOR_OPERATIONS_VIEW"],
  ["src/app/api/distributor/orders/[id]/accept/route.ts", "DISTRIBUTOR_OPERATIONS_MANAGE"],
  ["src/app/api/distributor/orders/[id]/reject/route.ts", "DISTRIBUTOR_OPERATIONS_MANAGE"],
  ["src/app/api/distributor/profile/route.ts", "DISTRIBUTOR_OPERATIONS_MANAGE"],
  ["src/app/api/distributor/tours/route.ts", "DISTRIBUTOR_OPERATIONS_VIEW"],
  ["src/app/api/distributor/tours/[id]/route.ts", "DISTRIBUTOR_OPERATIONS_VIEW"],
  ["src/app/api/distributor/tours/[id]/start/route.ts", "DISTRIBUTOR_OPERATIONS_MANAGE"],
  ["src/app/api/distributor/tours/[id]/pause/route.ts", "DISTRIBUTOR_OPERATIONS_MANAGE"],
  ["src/app/api/distributor/tours/[id]/resume/route.ts", "DISTRIBUTOR_OPERATIONS_MANAGE"],
  ["src/app/api/distributor/tours/[id]/pickup/route.ts", "DISTRIBUTOR_OPERATIONS_MANAGE"],
  ["src/app/api/distributor/tours/[id]/gps/route.ts", "DISTRIBUTOR_OPERATIONS_MANAGE"],
  ["src/app/api/distributor/tours/[id]/photo/route.ts", "DISTRIBUTOR_OPERATIONS_MANAGE"],
  ["src/app/api/distributor/tours/[id]/complete/route.ts", "DISTRIBUTOR_OPERATIONS_MANAGE"],
  ["src/app/api/distributor/support/tickets/route.ts", "DISTRIBUTOR_SUPPORT_VIEW"],
  ["src/app/api/distributor/support/tickets/[id]/route.ts", "DISTRIBUTOR_SUPPORT_VIEW"],
  ["src/app/api/distributor/support/tickets/[id]/message/route.ts", "DISTRIBUTOR_SUPPORT_MANAGE"],
]);

for (const [filePath, permission] of routePermissions) {
  const source = await readFile(filePath, "utf8");
  assert.match(source, new RegExp(`requirePermission\\(Permission\\.${permission}\\)`), `${filePath} fehlt ${permission}.`);
  assert.doesNotMatch(source, /requireRole\(\[UserRole\.DISTRIBUTOR\]\)/, `${filePath} verwendet noch die direkte Rollenpruefung.`);
}

console.log("Role-permission migration smoke checks passed.");
