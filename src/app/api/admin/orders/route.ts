import { OrderStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { productionOrderWhere } from "@/lib/productionData";
import { routeErrorResponse } from "@/lib/request";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.ORDER_VIEW);
    const params = request.nextUrl.searchParams;
    const status = params.get("status") as OrderStatus | null;
    const city = params.get("city") || undefined;
    const search = params.get("search") || undefined;

    const orders = await prisma.order.findMany({
      where: {
        ...productionOrderWhere(),
        ...(status ? { status } : {}),
        ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
        ...(search
          ? {
              OR: [
                { orderNumber: { contains: search, mode: "insensitive" } },
                { targetAreaName: { contains: search, mode: "insensitive" } },
                { customer: { companyName: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        customer: true,
        payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, amount: true } },
        documents: { select: { id: true, customerVisible: true, status: true } },
        reports: { orderBy: { updatedAt: "desc" }, take: 1, select: { id: true, status: true, publishedAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ ok: true, data: orders });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
