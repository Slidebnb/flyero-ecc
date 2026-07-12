import { requireTenantSession } from "@/lib/tenant";
import { readGeneratedAsset } from "@/lib/generatedAssets";
import { markInvoiceDownloaded } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireTenantSession();
    const { id } = await context.params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: session.tenantId, customer: { userId: session.id, tenantId: session.tenantId }, pdfUrl: { not: null } },
    });
    if (!invoice?.pdfUrl) return errorResponse("PDF wurde nicht gefunden.", 404);
    const pdf = await readGeneratedAsset(invoice.pdfUrl);
    await markInvoiceDownloaded({ invoiceId: invoice.id, userId: session.id });
    return new Response(pdf.buffer, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
