import { requireTenantSession } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";

export async function GET() {
  try {
    const session = await requireTenantSession();
    const customer = await prisma.customerProfile.findFirst({ where: { userId: session.id, tenantId: session.tenantId } });
    if (!customer) return errorResponse("Kundenprofil wurde nicht gefunden.", 404);
    const invoices = await prisma.invoice.findMany({
      where: { customerId: customer.id, tenantId: session.tenantId },
      include: { order: true, payment: true, items: true },
      orderBy: { invoiceDate: "desc" },
    });
    return Response.json({ ok: true, data: invoices });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
