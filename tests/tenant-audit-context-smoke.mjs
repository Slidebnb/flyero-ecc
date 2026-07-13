import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const documents = await readFile("src/lib/documents.ts", "utf8");
const photoReview = await readFile("src/app/api/admin/report-photos/[id]/route.ts", "utf8");

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

console.log("Tenant audit context smoke checks passed.");
