import { readFile } from "node:fs/promises";
import path from "node:path";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { markInvoiceDownloaded } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.CUSTOMER]);
    const { id } = await context.params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, customer: { userId: session.id }, pdfUrl: { not: null } },
    });
    if (!invoice?.pdfUrl) return errorResponse("PDF wurde nicht gefunden.", 404);
    const filePath = path.join(process.cwd(), "public", invoice.pdfUrl.replace(/^\/+/, ""));
    const pdf = await readFile(filePath);
    await markInvoiceDownloaded({ invoiceId: invoice.id, userId: session.id });
    return new Response(pdf, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
