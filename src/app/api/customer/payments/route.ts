import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";

export async function GET() {
  try {
    const session = await requireRole([UserRole.CUSTOMER]);
    const customer = await prisma.customerProfile.findUnique({ where: { userId: session.id } });
    if (!customer) return errorResponse("Kundenprofil wurde nicht gefunden.", 404);
    const payments = await prisma.payment.findMany({
      where: { customerId: customer.id },
      include: { order: true, refunds: true },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ ok: true, data: payments });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
