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
  "model Invoice",
  "paymentId",
  "invoiceDate",
  "subtotalNet",
  "model InvoiceItem",
  "model CreditNote",
  "CREDITED",
]);
await includes("src/lib/invoices.ts", [
  "generateInvoiceNumber",
  "FLY-RE-",
  "createInvoiceForOrder",
  "generateInvoicePdf",
  "invoice.created",
  "invoice.pdf_generated",
  "invoice.pdf_regenerated",
  "invoice.downloaded",
  "credit_note.prepared",
]);
await includes("src/app/api/admin/orders/[id]/status/route.ts", ["createInvoiceForOrder"]);

for (const filePath of [
  "src/app/customer/invoices/page.tsx",
  "src/app/customer/invoices/[id]/page.tsx",
  "src/app/api/customer/invoices/route.ts",
  "src/app/api/customer/invoices/[id]/route.ts",
  "src/app/api/customer/invoices/[id]/download/route.ts",
  "src/app/admin/invoices/page.tsx",
  "src/app/admin/invoices/[id]/page.tsx",
  "src/app/api/admin/invoices/route.ts",
  "src/app/api/admin/invoices/[id]/route.ts",
  "src/app/api/admin/invoices/[id]/regenerate-pdf/route.ts",
  "src/app/api/admin/invoices/[id]/cancel/route.ts",
  "src/app/api/internal/orders/[id]/create-invoice/route.ts",
]) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
}

await includes("README.md", ["Modul 11", "Rechnungsablauf", "FLY-RE-2026-000001", "PDF-Speicherort"]);
await includes("ARCHITECTURE_DECISIONS.md", ["Rechnung nach Zahlung", "idempotente Rechnungserzeugung", "Trennung Payment/Invoice"]);
await includes("DEMO_BENUTZER.txt", ["admin@example.com", "kunde.immobilien@example.com", "DemoPasswort123!"]);

const [
  invoiceCount,
  paidInvoiceCount,
  cancelledInvoiceCount,
  itemCount,
  creditNoteCount,
  uniqueNumbers,
  createdAudit,
  pdfAudit,
  downloadedAudit,
  cancelledAudit,
  creditAudit,
  notifications,
] = await Promise.all([
  prisma.invoice.count(),
  prisma.invoice.count({ where: { status: "PAID" } }),
  prisma.invoice.count({ where: { status: "CANCELLED" } }),
  prisma.invoiceItem.count(),
  prisma.creditNote.count(),
  prisma.invoice.groupBy({ by: ["invoiceNumber"] }),
  prisma.auditLog.count({ where: { action: "invoice.created" } }),
  prisma.auditLog.count({ where: { action: { in: ["invoice.pdf_generated", "invoice.pdf_regenerated"] } } }),
  prisma.auditLog.count({ where: { action: "invoice.downloaded" } }),
  prisma.auditLog.count({ where: { action: "invoice.cancelled" } }),
  prisma.auditLog.count({ where: { action: "credit_note.prepared" } }),
  prisma.notification.count({ where: { type: { in: ["INVOICE_AVAILABLE", "INVOICE_CREATED", "INVOICE_PDF_REGENERATED"] } } }),
]);

assert(invoiceCount >= 10, "Seed enthaelt weniger als 10 Rechnungen.");
assert(paidInvoiceCount >= 8, "Bezahlte Seed-Rechnungen fehlen.");
assert(cancelledInvoiceCount >= 1, "Stornierte Seed-Rechnung fehlt.");
assert(itemCount >= invoiceCount, "Rechnungspositionen fehlen.");
assert(creditNoteCount >= 1, "Vorbereitete Gutschrift fehlt.");
assert(uniqueNumbers.length === invoiceCount, "Rechnungsnummern sind nicht eindeutig.");
assert(createdAudit >= 1, "invoice.created AuditLog fehlt.");
assert(pdfAudit >= 1, "PDF AuditLog fehlt.");
assert(downloadedAudit >= 1, "invoice.downloaded AuditLog fehlt.");
assert(cancelledAudit >= 1, "invoice.cancelled AuditLog fehlt.");
assert(creditAudit >= 1, "credit_note.prepared AuditLog fehlt.");
assert(notifications >= 2, "Invoice Notifications fehlen.");

const invoiceWithPdf = await prisma.invoice.findFirst({ where: { pdfUrl: { not: null } }, include: { payment: true, items: true } });
assert(invoiceWithPdf, "Rechnung mit PDF fehlt.");
assert(invoiceWithPdf.paymentId, "Rechnung ist nicht mit Payment verbunden.");
assert(invoiceWithPdf.items.length >= 1, "Rechnung hat keine Positionen.");
const pdfPath = path.join(process.cwd(), "public", invoiceWithPdf.pdfUrl.replace(/^\/+/, ""));
assert(existsSync(pdfPath), `Rechnungs-PDF fehlt: ${pdfPath}`);
const pdfHeader = await readFile(pdfPath, "utf8");
assert(pdfHeader.startsWith("%PDF-"), "Rechnungs-PDF hat keinen PDF-Header.");

await prisma.$disconnect();
console.log("Module 11 smoke checks passed.");
