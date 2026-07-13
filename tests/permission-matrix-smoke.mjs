import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [permissions, matrix, users, userStatus, refund, reportPublish, reportApprove, analytics, analyticsExport, accounting, pricing, invoiceDownload] = await Promise.all([
  readFile("src/lib/permissions.ts", "utf8"),
  readFile("PERMISSION_MATRIX.md", "utf8"),
  readFile("src/app/api/admin/settings/users/route.ts", "utf8"),
  readFile("src/app/api/admin/settings/users/[id]/status/route.ts", "utf8"),
  readFile("src/app/api/admin/payments/[id]/refund/route.ts", "utf8"),
  readFile("src/app/api/admin/reports/[id]/publish/route.ts", "utf8"),
  readFile("src/app/api/admin/reports/[id]/approve/route.ts", "utf8"),
  readFile("src/app/api/admin/analytics/route.ts", "utf8"),
  readFile("src/app/api/admin/analytics/export/route.ts", "utf8"),
  readFile("src/app/api/admin/accounting/exports/route.ts", "utf8"),
  readFile("src/app/api/admin/settings/pricing/route.ts", "utf8"),
  readFile("src/app/api/admin/invoices/[id]/download/route.ts", "utf8"),
]);

for (const permission of [
  "ACCOUNTING_EXPORT",
  "ANALYTICS_EXPORT",
  "INTERNAL_USERS_MANAGE",
  "PAYMENT_REFUND",
  "PRICING_MANAGE",
  "REPORT_PUBLISH",
  "INVOICE_VIEW",
  "WAREHOUSE_MANAGE",
  "WAREHOUSE_VIEW",
]) {
  assert.match(permissions, new RegExp(`${permission}:`), `Permission ${permission} fehlt.`);
}
assert.match(permissions, /SUPPORT_DISPATCHER/);
assert.match(permissions, /REPORT_REVIEW/);
assert.match(matrix, /Support\/Disposition[\s\S]*?Nein/);

for (const [source, permission] of [
  [users, "INTERNAL_USERS_MANAGE"],
  [userStatus, "INTERNAL_USERS_MANAGE"],
  [refund, "PAYMENT_REFUND"],
  [reportPublish, "REPORT_PUBLISH"],
  [reportApprove, "REPORT_REVIEW"],
  [analytics, "ANALYTICS_VIEW"],
  [analyticsExport, "ANALYTICS_EXPORT"],
  [accounting, "ACCOUNTING_EXPORT"],
  [pricing, "PRICING_MANAGE"],
  [invoiceDownload, "INVOICE_VIEW"],
]) {
  assert.match(source, new RegExp(`requirePermission\\(Permission\\.${permission}\\)`), `${permission} ist nicht serverseitig integriert.`);
}

const warehouseRoute = await readFile("src/app/api/admin/logistics/warehouses/[id]/route.ts", "utf8");
assert.match(warehouseRoute, /requirePermission\(Permission\.WAREHOUSE_VIEW\)/, "Lager-Lesen erzwingt keine aktive Unternehmensmitgliedschaft.");
assert.match(warehouseRoute, /requirePermission\(Permission\.WAREHOUSE_MANAGE\)/, "Lager-Stammdaten sind nicht auf Admin beschrÃ¤nkt.");
const printPartnerRoute = await readFile("src/app/api/admin/print-partners/route.ts", "utf8");
const printPartnerDetailRoute = await readFile("src/app/api/admin/print-partners/[id]/route.ts", "utf8");
const printPartnerPage = await readFile("src/app/admin/print-partners/page.tsx", "utf8");
assert.match(printPartnerRoute, /requirePermission\(Permission\.PRINT_PARTNER_VIEW\)/);
assert.match(printPartnerRoute, /requirePermission\(Permission\.PRINT_PARTNER_MANAGE\)/);
assert.match(printPartnerDetailRoute, /requirePermission\(Permission\.PRINT_PARTNER_MANAGE\)/);
assert.match(printPartnerPage, /hasPermission\(session, Permission\.PRINT_PARTNER_MANAGE\)/);

console.log("Permission-Matrix Smoke-Test erfolgreich abgeschlossen.");
