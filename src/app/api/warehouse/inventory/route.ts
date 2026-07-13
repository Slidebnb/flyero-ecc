import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { inventoryScopeForUser } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";
import { warehouseLocationSelect, warehouseOrderSelect } from "@/lib/warehousePrivacy";

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.WAREHOUSE_STAFF, UserRole.ADMIN]);
    const params = request.nextUrl.searchParams;
    const status = params.get("status") || undefined;
    const city = params.get("city") || undefined;
    const location = params.get("location") || undefined;
    const search = params.get("search") || undefined;

    const inventory = await prisma.warehouseInventory.findMany({
      where: {
        ...inventoryScopeForUser(session),
        ...(status ? { status: status as never } : {}),
        ...(city ? { order: { city: { contains: city, mode: "insensitive" } } } : {}),
        ...(location ? { warehouseLocation: { fullLabel: { contains: location, mode: "insensitive" } } } : {}),
        ...(search
          ? {
              OR: [
                { order: { orderNumber: { contains: search, mode: "insensitive" } } },
                { order: { customer: { companyName: { contains: search, mode: "insensitive" } } } },
                { qrCode: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        status: true,
        remainingStockStatus: true,
        remainingFlyers: true,
        expectedFlyers: true,
        receivedFlyers: true,
        damagedFlyers: true,
        warehouseId: true,
        warehouseLocationId: true,
        order: { select: warehouseOrderSelect },
        warehouseLocation: { select: warehouseLocationSelect },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ ok: true, data: inventory });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
