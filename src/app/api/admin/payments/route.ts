import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { productionPaymentWhere } from "@/lib/productionData";
import { routeErrorResponse } from "@/lib/request";

export async function GET() {
  try {
    await requirePermission(Permission.PAYMENT_VIEW);
    const payments = await prisma.payment.findMany({
      where: productionPaymentWhere(),
      include: { order: { include: { customer: true } }, refunds: true, provider: true },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json({ ok: true, data: payments });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
