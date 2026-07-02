import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.CUSTOMER]);
    const { id } = await context.params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, customer: { userId: session.id } },
      include: { order: true, payment: true, items: true, creditNotes: true },
    });
    if (!invoice) return errorResponse("Rechnung wurde nicht gefunden.", 404);
    return Response.json({ ok: true, data: invoice });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
