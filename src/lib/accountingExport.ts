import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AccountingExportFormat, AccountingExportStatus, AccountingExportType, Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { formatAddress } from "@/lib/format";
import { logBackgroundJobFailure, logBackgroundJobStart, logBackgroundJobSuccess } from "@/lib/monitoring";
import { notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const EXPORT_DIR = path.join(process.cwd(), "public", "generated", "accounting");

type InvoiceExport = Prisma.InvoiceGetPayload<{
  include: { customer: true; order: true; payment: true; items: true };
}>;
type PaymentExport = Prisma.PaymentGetPayload<{
  include: { customer: true; order: true; refunds: true };
}>;
type CreditNoteExport = Prisma.CreditNoteGetPayload<{
  include: { invoice: { include: { customer: true; order: true } } };
}>;

function pad(value: number) {
  return String(value).padStart(6, "0");
}

function csvEscape(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

function toIsoDate(value?: Date | string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function decimal(value: unknown) {
  return value && typeof value === "object" && "toString" in value ? value.toString() : String(value ?? "0");
}

function csv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(";")).join("\r\n") + "\r\n";
}

export async function generateExportNumber() {
  const year = new Date().getFullYear();
  const prefix = `ACC-${year}-`;
  const count = await prisma.accountingExport.count({ where: { exportNumber: { startsWith: prefix } } });
  return `${prefix}${pad(count + 1)}`;
}

export async function collectInvoicesForPeriod(periodStart: Date, periodEnd: Date) {
  return prisma.invoice.findMany({
    where: {
      invoiceDate: { gte: periodStart, lte: periodEnd },
      status: { not: "DRAFT" },
    },
    include: { customer: true, order: true, payment: true, items: true },
    orderBy: [{ invoiceDate: "asc" }, { invoiceNumber: "asc" }],
  });
}

export async function collectPaymentsForPeriod(periodStart: Date, periodEnd: Date) {
  return prisma.payment.findMany({
    where: {
      OR: [
        { paidAt: { gte: periodStart, lte: periodEnd } },
        { createdAt: { gte: periodStart, lte: periodEnd } },
      ],
    },
    include: { customer: true, order: true, refunds: true },
    orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
  });
}

export async function collectCreditNotesForPeriod(periodStart: Date, periodEnd: Date) {
  return prisma.creditNote.findMany({
    where: { createdAt: { gte: periodStart, lte: periodEnd } },
    include: { invoice: { include: { customer: true, order: true } } },
    orderBy: [{ createdAt: "asc" }, { creditNoteNumber: "asc" }],
  });
}

export function generateLexwareCsv(input: { invoices: InvoiceExport[]; payments: PaymentExport[]; creditNotes: CreditNoteExport[] }) {
  const rows = [
    ...input.invoices.map((invoice) => [
      "Rechnung",
      invoice.invoiceNumber,
      toIsoDate(invoice.invoiceDate ?? invoice.createdAt),
      invoice.customer.companyName,
      formatAddress(invoice.customer.billingAddress),
      decimal(invoice.subtotalNet),
      decimal(invoice.vatAmount),
      decimal(invoice.totalGross),
      invoice.payment?.status ?? invoice.status,
      toIsoDate(invoice.paidAt ?? invoice.payment?.paidAt),
      invoice.order.orderNumber,
      invoice.payment?.stripePaymentIntentId ?? invoice.payment?.stripeCheckoutSessionId ?? "",
      invoice.items.map((item) => item.title).join(", ") || `Flyerverteilung ${invoice.order.targetAreaName}`,
    ]),
    ...input.payments.map((payment) => [
      "Zahlung",
      payment.stripePaymentIntentId ?? payment.stripeCheckoutSessionId ?? payment.id,
      toIsoDate(payment.paidAt ?? payment.createdAt),
      payment.customer.companyName,
      formatAddress(payment.customer.billingAddress),
      "",
      "",
      decimal(payment.amount),
      payment.status,
      toIsoDate(payment.paidAt),
      payment.order.orderNumber,
      payment.stripePaymentIntentId ?? payment.stripeCheckoutSessionId ?? "",
      payment.description,
    ]),
    ...input.creditNotes.map((creditNote) => [
      "Gutschrift",
      creditNote.creditNoteNumber,
      toIsoDate(creditNote.createdAt),
      creditNote.invoice.customer.companyName,
      formatAddress(creditNote.invoice.customer.billingAddress),
      decimal(creditNote.amountNet),
      decimal(creditNote.vatAmount),
      decimal(creditNote.totalGross),
      creditNote.status,
      "",
      creditNote.invoice.order.orderNumber,
      creditNote.invoice.invoiceNumber,
      creditNote.reason,
    ]),
  ];
  return csv(["Typ", "Belegnummer", "Belegdatum", "Kunde", "Adresse", "Netto", "MwSt", "Brutto", "Zahlungsstatus", "Zahlungsdatum", "Auftragsnummer", "Stripe Referenz", "Leistungsbeschreibung"], rows);
}

export function generateDatevCsv(input: { invoices: InvoiceExport[]; payments: PaymentExport[]; creditNotes: CreditNoteExport[] }) {
  const invoiceRows = input.invoices.map((invoice) => [
    toIsoDate(invoice.invoiceDate ?? invoice.createdAt),
    invoice.invoiceNumber,
    `Ausgangsrechnung ${invoice.customer.companyName} ${invoice.order.orderNumber}`,
    decimal(invoice.totalGross),
    "SOLL",
    "19",
    `D-${invoice.customer.id.slice(-6).toUpperCase()}`,
    "8400",
  ]);
  const paymentRows = input.payments.map((payment) => [
    toIsoDate(payment.paidAt ?? payment.createdAt),
    payment.stripePaymentIntentId ?? payment.stripeCheckoutSessionId ?? payment.id,
    `Zahlung ${payment.order.orderNumber}`,
    decimal(payment.amount),
    "HABEN",
    "",
    `D-${payment.customer.id.slice(-6).toUpperCase()}`,
    "1200",
  ]);
  const creditRows = input.creditNotes.map((creditNote) => [
    toIsoDate(creditNote.createdAt),
    creditNote.creditNoteNumber,
    `Gutschrift ${creditNote.invoice.invoiceNumber}`,
    decimal(creditNote.totalGross),
    "HABEN",
    "19",
    `D-${creditNote.invoice.customer.id.slice(-6).toUpperCase()}`,
    "8400",
  ]);
  return csv(["Belegdatum", "Belegnummer", "Buchungstext", "Betrag", "Soll/Haben vorbereitet", "Steuerschluessel vorbereitet", "Debitor vorbereitet", "Gegenkonto vorbereitet"], [...invoiceRows, ...paymentRows, ...creditRows]);
}

export function generateGenericCsv(input: { invoices: InvoiceExport[]; payments: PaymentExport[]; creditNotes: CreditNoteExport[] }) {
  return csv(["EntityType", "EntityId", "Number", "Date", "Customer", "Amount", "Currency", "Status"], [
    ...input.invoices.map((invoice) => ["Invoice", invoice.id, invoice.invoiceNumber, toIsoDate(invoice.invoiceDate ?? invoice.createdAt), invoice.customer.companyName, decimal(invoice.totalGross), invoice.currency, invoice.status]),
    ...input.payments.map((payment) => ["Payment", payment.id, payment.stripePaymentIntentId ?? payment.stripeCheckoutSessionId ?? payment.id, toIsoDate(payment.paidAt ?? payment.createdAt), payment.customer.companyName, decimal(payment.amount), payment.currency, payment.status]),
    ...input.creditNotes.map((creditNote) => ["CreditNote", creditNote.id, creditNote.creditNoteNumber, toIsoDate(creditNote.createdAt), creditNote.invoice.customer.companyName, decimal(creditNote.totalGross), creditNote.invoice.currency, creditNote.status]),
  ]);
}

export function calculateChecksum(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

export async function markExportCompleted(input: { exportId: string; fileUrl: string; rowCount: number; checksum: string; userId?: string | null }) {
  const updated = await prisma.accountingExport.update({
    where: { id: input.exportId },
    data: { status: AccountingExportStatus.COMPLETED, fileUrl: input.fileUrl, rowCount: input.rowCount, checksum: input.checksum, completedAt: new Date() },
  });
  await createAuditLog({ userId: input.userId, action: "accounting.export_completed", entityType: "AccountingExport", entityId: updated.id, newValues: { fileUrl: updated.fileUrl, rowCount: updated.rowCount, checksum: updated.checksum } });
  await notifyAdmins({ type: "ACCOUNTING_EXPORT_COMPLETED", title: "Export fertig", message: `${updated.exportNumber} wurde fertiggestellt.` });
  return updated;
}

export async function archiveExport(input: { exportId: string; userId: string }) {
  const updated = await prisma.accountingExport.update({
    where: { id: input.exportId },
    data: { status: AccountingExportStatus.ARCHIVED },
  });
  await createAuditLog({ userId: input.userId, action: "accounting.export_archived", entityType: "AccountingExport", entityId: updated.id });
  return updated;
}

function shouldInclude(type: AccountingExportType, target: "invoices" | "payments" | "creditNotes") {
  if (type === AccountingExportType.FULL_ACCOUNTING) return true;
  if (type === AccountingExportType.INVOICES) return target === "invoices";
  if (type === AccountingExportType.PAYMENTS) return target === "payments";
  return target === "creditNotes";
}

export async function createAccountingExport(input: {
  type: AccountingExportType;
  format: AccountingExportFormat;
  periodStart: Date;
  periodEnd: Date;
  createdById?: string | null;
}) {
  const exportNumber = await generateExportNumber();
  const created = await prisma.accountingExport.create({
    data: {
      exportNumber,
      type: input.type,
      format: input.format,
      status: AccountingExportStatus.GENERATING,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      createdById: input.createdById ?? null,
    },
  });
  await createAuditLog({ userId: input.createdById, action: "accounting.export_created", entityType: "AccountingExport", entityId: created.id, newValues: { exportNumber, type: input.type, format: input.format } });
  const job = await logBackgroundJobStart("ACCOUNTING_EXPORT", {
    accountingExportId: created.id,
    type: input.type,
    format: input.format,
  });

  try {
    const [invoices, payments, creditNotes] = await Promise.all([
      shouldInclude(input.type, "invoices") ? collectInvoicesForPeriod(input.periodStart, input.periodEnd) : Promise.resolve([]),
      shouldInclude(input.type, "payments") ? collectPaymentsForPeriod(input.periodStart, input.periodEnd) : Promise.resolve([]),
      shouldInclude(input.type, "creditNotes") ? collectCreditNotesForPeriod(input.periodStart, input.periodEnd) : Promise.resolve([]),
    ]);
    const payload = { invoices, payments, creditNotes };
    const csvContent =
      input.format === AccountingExportFormat.CSV_LEXWARE
        ? generateLexwareCsv(payload)
        : input.format === AccountingExportFormat.CSV_DATEV
          ? generateDatevCsv(payload)
          : generateGenericCsv(payload);

    await mkdir(EXPORT_DIR, { recursive: true });
    const fileName = `flyero-accounting-export-${exportNumber}.csv`;
    const filePath = path.join(EXPORT_DIR, fileName);
    await writeFile(filePath, csvContent, "utf8");
    const checksum = calculateChecksum(csvContent);
    const itemRows = [
      ...invoices.map((invoice) => ({ exportId: created.id, entityType: "Invoice", entityId: invoice.id })),
      ...payments.map((payment) => ({ exportId: created.id, entityType: "Payment", entityId: payment.id })),
      ...creditNotes.map((creditNote) => ({ exportId: created.id, entityType: "CreditNote", entityId: creditNote.id })),
    ];
    if (itemRows.length) await prisma.accountingExportItem.createMany({ data: itemRows });
    const completed = await markExportCompleted({
      exportId: created.id,
      fileUrl: `/generated/accounting/${fileName}`,
      rowCount: itemRows.length,
      checksum,
      userId: input.createdById,
    });
    await logBackgroundJobSuccess(job.id, { accountingExportId: created.id, rowCount: itemRows.length });
    return completed;
  } catch (error) {
    const failed = await prisma.accountingExport.update({ where: { id: created.id }, data: { status: AccountingExportStatus.FAILED, completedAt: new Date() } });
    await createAuditLog({ userId: input.createdById, action: "accounting.export_failed", entityType: "AccountingExport", entityId: failed.id, newValues: { error: error instanceof Error ? error.message : String(error) } });
    await logBackgroundJobFailure(job.id, error, { accountingExportId: created.id });
    await notifyAdmins({ type: "ACCOUNTING_EXPORT_FAILED", title: "Export fehlgeschlagen", message: `${created.exportNumber} konnte nicht erzeugt werden.` });
    throw error;
  }
}
