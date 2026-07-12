import { requireTenantSession } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireTenantSession();
    const { id } = await context.params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: session.tenantId, customer: { userId: session.id, tenantId: session.tenantId } },
      include: { order: true, payment: true, items: true, creditNotes: true },
    });
    if (!invoice) return errorResponse("Rechnung wurde nicht gefunden.", 404);
    return Response.json({ ok: true, data: invoice });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
