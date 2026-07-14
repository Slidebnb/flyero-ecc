import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { productionInvoiceWhere } from "@/lib/productionData";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(Permission.INVOICE_ADMIN_VIEW);
    const { id } = await context.params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, ...productionInvoiceWhere() },
      include: { customer: true, order: true, payment: true, items: true, creditNotes: true },
    });
    if (!invoice) return errorResponse("Rechnung wurde nicht gefunden.", 404);
    return Response.json({ ok: true, data: invoice });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
