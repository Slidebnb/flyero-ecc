import { readGeneratedAsset } from "@/lib/generatedAssets";
import { privateDownloadHeaders } from "@/lib/downloadHeaders";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { tenantWhereForSession } from "@/lib/tenantPolicy";
import { productionInvoiceWhere } from "@/lib/productionData";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.INVOICE_VIEW);
    const { id } = await context.params;
    const invoice = await prisma.invoice.findFirst({ where: { id, ...tenantWhereForSession(session), ...productionInvoiceWhere() } });
    if (!invoice?.pdfUrl) return errorResponse("PDF wurde nicht gefunden.", 404);
    const file = await readGeneratedAsset(invoice.pdfUrl);
    return new Response(file.buffer, {
      headers: privateDownloadHeaders({ contentType: "application/pdf", filename: `${invoice.invoiceNumber}.pdf` }),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
