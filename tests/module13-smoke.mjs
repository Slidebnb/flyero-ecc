import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function includes(filePath, snippets) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
  const content = await readFile(filePath, "utf8");
  for (const snippet of snippets) {
    assert(content.includes(snippet), `${filePath} enthaelt nicht: ${snippet}`);
  }
  return content;
}

await includes("prisma/schema.prisma", [
  "enum AccountingExportType",
  "INVOICES",
  "PAYMENTS",
  "CREDIT_NOTES",
  "FULL_ACCOUNTING",
  "model AccountingExport",
  "model AccountingExportItem",
]);

await includes("src/lib/accountingExport.ts", [
  "createAccountingExport",
  "generateExportNumber",
  "collectInvoicesForPeriod",
  "collectPaymentsForPeriod",
  "collectCreditNotesForPeriod",
  "generateLexwareCsv",
  "generateDatevCsv",
  "generateGenericCsv",
  "calculateChecksum",
  "markExportCompleted",
  "archiveExport",
]);

for (const filePath of [
  "src/app/admin/accounting/page.tsx",
  "src/app/api/admin/accounting/exports/route.ts",
  "src/app/api/admin/accounting/exports/[id]/route.ts",
  "src/app/api/admin/accounting/exports/[id]/download/route.ts",
  "src/app/api/admin/accounting/exports/[id]/archive/route.ts",
]) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
}

await includes("README.md", ["Modul 13", "Accounting Export", "Lexware CSV", "DATEV"]);
await includes("ARCHITECTURE_DECISIONS.md", ["Export zuerst", "DATEV", "Steuerberater"]);

const [
  exportCount,
  completedCount,
  failedCount,
  archivedCount,
  itemCount,
  auditCreated,
  auditCompleted,
  auditFailed,
  auditDownloaded,
  auditArchived,
  notifications,
] = await Promise.all([
  prisma.accountingExport.count(),
  prisma.accountingExport.count({ where: { status: "COMPLETED" } }),
  prisma.accountingExport.count({ where: { status: "FAILED" } }),
  prisma.accountingExport.count({ where: { status: "ARCHIVED" } }),
  prisma.accountingExportItem.count(),
  prisma.auditLog.count({ where: { action: "accounting.export_created" } }),
  prisma.auditLog.count({ where: { action: "accounting.export_completed" } }),
  prisma.auditLog.count({ where: { action: "accounting.export_failed" } }),
  prisma.auditLog.count({ where: { action: "accounting.export_downloaded" } }),
  prisma.auditLog.count({ where: { action: "accounting.export_archived" } }),
  prisma.notification.count({ where: { type: { in: ["ACCOUNTING_EXPORT_COMPLETED", "ACCOUNTING_EXPORT_FAILED"] } } }),
]);

assert(exportCount >= 5, "Seed enthaelt weniger als 5 AccountingExports.");
assert(completedCount >= 3, "Completed AccountingExports fehlen.");
assert(failedCount >= 1, "Failed AccountingExport fehlt.");
assert(archivedCount >= 1, "Archived AccountingExport fehlt.");
assert(itemCount >= 5, "AccountingExportItems fehlen.");
assert(auditCreated >= 1, "accounting.export_created AuditLog fehlt.");
assert(auditCompleted >= 1, "accounting.export_completed AuditLog fehlt.");
assert(auditFailed >= 1, "accounting.export_failed AuditLog fehlt.");
assert(auditDownloaded >= 1, "accounting.export_downloaded AuditLog fehlt.");
assert(auditArchived >= 1, "accounting.export_archived AuditLog fehlt.");
assert(notifications >= 2, "Accounting Export Notifications fehlen.");

const completed = await prisma.accountingExport.findFirst({ where: { status: "COMPLETED", fileUrl: { not: null } }, include: { items: true } });
assert(completed, "Completed Export mit Datei fehlt.");
assert(completed.items.length >= 1, "Completed Export hat keine Items.");
const csvPath = completed.fileUrl.startsWith("/private/generated/accounting/")
  ? path.join(process.cwd(), "storage", completed.fileUrl.replace(/^\/+private\/generated\/accounting\//, "generated/accounting/"))
  : path.join(process.cwd(), "public", completed.fileUrl.replace(/^\/+/, ""));
assert(existsSync(csvPath), `CSV-Datei fehlt: ${csvPath}`);
const csvContent = await readFile(csvPath, "utf8");
assert(csvContent.includes("Exportnummer") || csvContent.includes("Belegnummer") || csvContent.includes("EntityType"), "CSV-Inhalt wirkt ungueltig.");

await prisma.$disconnect();
console.log("Module 13 smoke checks passed.");
