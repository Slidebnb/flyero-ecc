import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { formatAddress, formatDate, formatDateTime } from "@/lib/format";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { generateSettingsNumber, getBrandingSettings, getCompanySettings, getSystemSettings } from "@/lib/settings";

const INVOICE_DIR = path.join(process.cwd(), "public", "generated", "invoices");

function pad(value: number, length = 6) {
  return String(value).padStart(length, "0");
}

export async function generateInvoiceNumber() {
  // Default numbering still uses the familiar FLY-RE-2026-000001 shape via NumberingSettings.
  return generateSettingsNumber("invoice");
}

export async function generateCreditNoteNumber() {
  const now = new Date();
  const prefix = `FLY-GS-${now.getFullYear()}-`;
  const count = await prisma.creditNote.count({ where: { creditNoteNumber: { startsWith: prefix } } });
  return `${prefix}${pad(count + 1)}`;
}

function escapePdfText(value: unknown) {
  return String(value ?? "-").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]) {
  const content = [
    "BT",
    "/F1 17 Tf",
    "50 790 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? "" : "0 -23 Td",
      `(${escapePdfText(line).slice(0, 115)}) Tj`,
    ]),
    "ET",
  ].filter(Boolean).join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`,
  ];
  let offset = "%PDF-1.4\n".length;
  const xref = ["0000000000 65535 f "];
  const body = objects.map((object) => {
    xref.push(`${String(offset).padStart(10, "0")} 00000 n `);
    offset += Buffer.byteLength(`${object}\n`);
    return `${object}\n`;
  }).join("");
  return Buffer.from(
    `%PDF-1.4\n${body}xref\n0 ${objects.length + 1}\n${xref.join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`,
  );
}

export async function generateInvoicePdf(invoiceId: string, options?: { regeneratedById?: string | null }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      order: true,
      customer: true,
      payment: true,
      items: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!invoice) throw new Error("Rechnung wurde nicht gefunden.");
  const [company, branding] = await Promise.all([getCompanySettings(), getBrandingSettings()]);
  const billingAddress = formatAddress(invoice.customer.billingAddress);
  const lines = [
    `${company.companyName} Rechnung`,
    `Rechnungsnummer: ${invoice.invoiceNumber}`,
    `Rechnungsdatum: ${formatDate(invoice.invoiceDate ?? invoice.createdAt)}`,
    `Kunde: ${invoice.customer.companyName}`,
    `Rechnungsadresse: ${billingAddress.replace(/\n/g, ", ")}`,
    `Auftragsnummer: ${invoice.order.orderNumber}`,
    `Zahlungsreferenz: ${invoice.payment?.stripePaymentIntentId ?? invoice.payment?.stripeCheckoutSessionId ?? "-"}`,
    `Leistungsdatum: ${formatDate(invoice.serviceDate ?? invoice.invoiceDate ?? invoice.createdAt)}`,
    ...invoice.items.map((item) => `${item.title}: ${item.quantity.toString()} ${item.unit} x ${item.unitPriceNet.toString()} EUR netto`),
    `Netto: ${invoice.subtotalNet.toString()} ${invoice.currency}`,
    `MwSt. ${invoice.vatRate.mul(100).toDecimalPlaces(0).toString()}%: ${invoice.vatAmount.toString()} ${invoice.currency}`,
    `Brutto: ${invoice.totalGross.toString()} ${invoice.currency}`,
    "Hinweis: bereits bezahlt",
    `Zahlungsdatum: ${formatDateTime(invoice.paidAt)}`,
    `Footer: ${branding.invoiceFooterText || `${company.legalName} / ${company.street} / ${company.postalCode} ${company.city} / ${company.vatId ?? "-"}`}`,
  ];
  const pdf = buildSimplePdf(lines);
  await mkdir(INVOICE_DIR, { recursive: true });
  const fileName = `${invoice.invoiceNumber.toLowerCase()}.pdf`;
  const filePath = path.join(INVOICE_DIR, fileName);
  await writeFile(filePath, pdf);
  const checksum = createHash("sha256").update(pdf).digest("hex");
  const pdfUrl = `/generated/invoices/${fileName}`;
  await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfUrl } });
  await createAuditLog({
    userId: options?.regeneratedById ?? null,
    action: options?.regeneratedById ? "invoice.pdf_regenerated" : "invoice.pdf_generated",
    entityType: "Invoice",
    entityId: invoice.id,
    newValues: { pdfUrl, checksum },
  });
  if (options?.regeneratedById) {
    await notifyAdmins({
      type: "INVOICE_PDF_REGENERATED",
      title: "Rechnung PDF neu erzeugt",
      message: `${invoice.invoiceNumber} wurde neu erzeugt.`,
    });
  }
  return { pdfUrl, filePath, checksum };
}

export async function createInvoiceForOrder(input: { orderId: string; adminUserId?: string | null }) {
  const existing = await prisma.invoice.findUnique({ where: { orderId: input.orderId } });
  if (existing) return existing;

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      customer: true,
      payments: { where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 1 },
    },
  });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");
  if (order.status !== "APPROVED") throw new Error("Rechnung kann erst nach Admin-Genehmigung erzeugt werden.");
  const payment = order.payments[0];
  if (!payment) throw new Error("Keine erfolgreiche Zahlung für diesen Auftrag gefunden.");

  const system = await getSystemSettings();
  const subtotalNet = order.manualPriceOverride ?? order.calculatedNetPrice;
  const vatAmount = subtotalNet.mul(system.defaultVatRate).toDecimalPlaces(2);
  const totalGross = subtotalNet.plus(vatAmount).toDecimalPlaces(2);
  const now = new Date();
  let invoice: Awaited<ReturnType<typeof prisma.invoice.create>> | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const invoiceNumber = await generateInvoiceNumber();
    try {
      invoice = await prisma.$transaction(async (tx) => {
        const created = await tx.invoice.create({
          data: {
            orderId: order.id,
            customerId: order.customerId,
            paymentId: payment.id,
            invoiceNumber,
            status: "PAID",
            currency: payment.currency,
            invoiceDate: now,
            serviceDate: order.preferredStartDate,
            dueDate: new Date(now.getTime() + system.paymentDueDays * 24 * 60 * 60 * 1000),
            paidAt: payment.paidAt ?? now,
            subtotalNet,
            vatRate: system.defaultVatRate,
            vatAmount,
            totalGross,
            amountNet: subtotalNet,
            amountGross: totalGross,
            notes: "Automatisch nach Zahlung und Admin-Genehmigung erzeugt.",
            items: {
              create: {
                title: "Flyerverteilung",
                description: `Flyerverteilung ${order.targetAreaName}, ${order.city}`,
                quantity: new Prisma.Decimal(order.flyerQuantity),
                unit: "Flyer",
                unitPriceNet: subtotalNet.div(order.flyerQuantity).toDecimalPlaces(4),
                vatRate: system.defaultVatRate,
                lineTotalNet: subtotalNet,
              },
            },
          },
        });
        return created;
      });
      break;
    } catch (error) {
      const target = error instanceof Prisma.PrismaClientKnownRequestError ? error.meta?.target : null;
      const isInvoiceNumberCollision =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        (!target || target === "(not available)" || (Array.isArray(target) && target.includes("invoiceNumber")));
      if (!isInvoiceNumberCollision || attempt === 2) throw error;
    }
  }

  if (!invoice) throw new Error("Rechnung konnte nicht erstellt werden.");

  const pdf = await generateInvoicePdf(invoice.id);
  const updated = await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfUrl: pdf.pdfUrl } });
  await createAuditLog({
    userId: input.adminUserId ?? null,
    action: "invoice.created",
    entityType: "Invoice",
    entityId: updated.id,
    newValues: { invoiceNumber: updated.invoiceNumber, orderId: order.id, paymentId: payment.id },
  });
  await createNotification({
    userId: order.customer.userId,
    type: "INVOICE_AVAILABLE",
    title: "Rechnung verfügbar",
    message: `Rechnung ${updated.invoiceNumber} für Auftrag ${order.orderNumber} ist verfügbar.`,
  });
  await notifyAdmins({
    type: "INVOICE_CREATED",
    title: "Rechnung erstellt",
    message: `${updated.invoiceNumber} für ${order.orderNumber} wurde erstellt.`,
  });
  return updated;
}

export async function cancelInvoice(input: { invoiceId: string; adminUserId: string; reason?: string | null }) {
  const invoice = await prisma.invoice.update({
    where: { id: input.invoiceId },
    data: { status: "CANCELLED", notes: input.reason ?? "Storno vorbereitet." },
  });
  await createAuditLog({
    userId: input.adminUserId,
    action: "invoice.cancelled",
    entityType: "Invoice",
    entityId: invoice.id,
    newValues: { reason: input.reason ?? null },
  });
  return invoice;
}

export async function prepareCreditNote(input: { invoiceId: string; adminUserId: string; reason: string }) {
  const invoice = await prisma.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new Error("Rechnung wurde nicht gefunden.");
  const creditNote = await prisma.creditNote.create({
    data: {
      creditNoteNumber: await generateCreditNoteNumber(),
      invoiceId: invoice.id,
      reason: input.reason,
      amountNet: invoice.subtotalNet,
      vatAmount: invoice.vatAmount,
      totalGross: invoice.totalGross,
      status: "PREPARED",
    },
  });
  await createAuditLog({
    userId: input.adminUserId,
    action: "credit_note.prepared",
    entityType: "CreditNote",
    entityId: creditNote.id,
    newValues: { invoiceId: invoice.id, reason: input.reason },
  });
  return creditNote;
}

export async function markInvoiceDownloaded(input: { invoiceId: string; userId?: string | null }) {
  await createAuditLog({
    userId: input.userId ?? null,
    action: "invoice.downloaded",
    entityType: "Invoice",
    entityId: input.invoiceId,
  });
}
