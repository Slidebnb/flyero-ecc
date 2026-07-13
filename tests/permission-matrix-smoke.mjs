import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [permissions, matrix, users, userStatus, refund, reportPublish, reportApprove, analytics, analyticsExport, accounting, pricing, invoiceDownload, adminOrders, adminOrderDetail, adminOrderStatus, adminOrderPrice, adminOrderAssign, adminInvoices, adminInvoiceDetail, adminInvoiceCancel, adminInvoicePdf, adminPayments] = await Promise.all([
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
  readFile("src/app/api/admin/orders/route.ts", "utf8"),
  readFile("src/app/api/admin/orders/[id]/route.ts", "utf8"),
  readFile("src/app/api/admin/orders/[id]/status/route.ts", "utf8"),
  readFile("src/app/api/admin/orders/[id]/price/route.ts", "utf8"),
  readFile("src/app/api/admin/orders/[id]/assign/route.ts", "utf8"),
  readFile("src/app/api/admin/invoices/route.ts", "utf8"),
  readFile("src/app/api/admin/invoices/[id]/route.ts", "utf8"),
  readFile("src/app/api/admin/invoices/[id]/cancel/route.ts", "utf8"),
  readFile("src/app/api/admin/invoices/[id]/regenerate-pdf/route.ts", "utf8"),
  readFile("src/app/api/admin/payments/route.ts", "utf8"),
]);

for (const permission of [
  "ACCOUNTING_EXPORT",
  "ANALYTICS_EXPORT",
  "ORDER_VIEW",
  "ORDER_MANAGE",
  "DISPATCH_ASSIGN",
  "INTERNAL_USERS_MANAGE",
  "INVOICE_ADMIN_VIEW",
  "INVOICE_MANAGE",
  "PAYMENT_VIEW",
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

for (const [source, permission] of [
  [adminOrders, "ORDER_VIEW"],
  [adminOrderDetail, "ORDER_VIEW"],
  [adminOrderStatus, "ORDER_MANAGE"],
  [adminOrderPrice, "ORDER_MANAGE"],
  [adminOrderAssign, "DISPATCH_ASSIGN"],
  [adminInvoices, "INVOICE_ADMIN_VIEW"],
  [adminInvoiceDetail, "INVOICE_ADMIN_VIEW"],
  [adminInvoiceCancel, "INVOICE_MANAGE"],
  [adminInvoicePdf, "INVOICE_MANAGE"],
  [adminPayments, "PAYMENT_VIEW"],
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
const printOrderRoute = await readFile("src/app/api/admin/print-orders/route.ts", "utf8");
const printOrderDetailRoute = await readFile("src/app/api/admin/print-orders/[id]/route.ts", "utf8");
const printOrderPage = await readFile("src/app/admin/print-orders/page.tsx", "utf8");
assert.match(printOrderRoute, /requirePermission\(Permission\.PRINT_ORDER_VIEW\)/);
assert.match(printOrderDetailRoute, /requirePermission\(Permission\.PRINT_ORDER_MANAGE\)/);
assert.match(printOrderPage, /requirePermission\(Permission\.PRINT_ORDER_VIEW\)/);

console.log("Permission-Matrix Smoke-Test erfolgreich abgeschlossen.");
