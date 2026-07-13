import { OrderStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
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
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ ok: true, data: orders });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
