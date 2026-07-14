import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { productionInvoiceWhere } from "@/lib/productionData";
import { routeErrorResponse } from "@/lib/request";

export async function GET() {
  try {
    await requirePermission(Permission.INVOICE_ADMIN_VIEW);
    const invoices = await prisma.invoice.findMany({
      where: productionInvoiceWhere(),
      include: { customer: true, order: true, payment: true, items: true, creditNotes: true },
      orderBy: { invoiceDate: "desc" },
    });
    return Response.json({ ok: true, data: invoices });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
