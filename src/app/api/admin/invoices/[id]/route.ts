import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireRole([UserRole.ADMIN]);
    const { id } = await context.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { customer: true, order: true, payment: true, items: true, creditNotes: true },
    });
    if (!invoice) return errorResponse("Rechnung wurde nicht gefunden.", 404);
    return Response.json({ ok: true, data: invoice });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
