import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requirePermission(Permission.PAYMENT_DISPUTE_MANAGE);
    const disputes = await prisma.paymentDispute.findMany({
      include: {
        payment: { select: { id: true, status: true, amount: true, currency: true, stripePaymentIntentId: true } },
        order: { select: { id: true, orderNumber: true } },
        customer: { select: { id: true, companyName: true } },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 200,
    });
    return successResponse(disputes);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
