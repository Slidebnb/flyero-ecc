import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const documents = await readFile("src/lib/documents.ts", "utf8");
const photoReview = await readFile("src/app/api/admin/report-photos/[id]/route.ts", "utf8");
const support = await readFile("src/lib/support.ts", "utf8");
const analyticsRoutes = await Promise.all([
  "src/app/api/admin/analytics/route.ts",
  "src/app/api/admin/analytics/distributors/route.ts",
  "src/app/api/admin/analytics/export/route.ts",
  "src/app/api/admin/analytics/orders/route.ts",
  "src/app/api/admin/analytics/revenue/route.ts",
].map((file) => readFile(file, "utf8")));

for (const action of [
  "document.uploaded",
  "document.version_uploaded",
  "document.updated",
  "document.approved",
  "document.scan_completed",
  "document.rejected",
  "document.downloaded",
  "print.requested",
  "print.received",
]) {
  const actionIndex = documents.indexOf(`action: "${action}"`);
  assert.notEqual(actionIndex, -1, `Audit-Aktion fehlt: ${action}`);
  const block = documents.slice(Math.max(0, actionIndex - 180), actionIndex + 260);
  assert.match(block, /tenantId:/, `Audit-Aktion ${action} muss Tenant-Kontext schreiben.`);
}

assert.match(photoReview, /tenantWhereForSession\(session\)/, "Foto-Pruefung muss tenant-gescoped bleiben.");
assert.match(photoReview, /createAuditLog\(\{[\s\S]*tenantId:\s*session\.tenantId/, "Foto-Pruefung muss Tenant-Kontext auditieren.");
for (const route of analyticsRoutes) {
  assert.match(route, /tenantId:\s*session\.tenantId/, "Analytics-Audit muss Tenant-Kontext schreiben.");
}
assert.match(support, /tenantId:\s*ticket\.tenantId,[\s\S]{0,180}action:\s*data\.type/, "Support-Ticket-Erstellung muss Tenant-Kontext auditieren.");
assert.match(support, /tenantId:\s*current\.tenantId,[\s\S]{0,180}action,/, "Support-Ticket-Änderungen müssen Tenant-Kontext auditieren.");
assert.match(support, /tenantId:\s*ticket\.tenantId,[\s\S]{0,180}action: "ticket\.message_added"/, "Support-Ticket-Antworten müssen Tenant-Kontext auditieren.");

console.log("Tenant audit context smoke checks passed.");
