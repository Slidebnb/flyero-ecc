import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN]);
    const payments = await prisma.payment.findMany({
      include: { order: { include: { customer: true } }, refunds: true, provider: true },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json({ ok: true, data: payments });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
