import { requireTenantSession } from "@/lib/tenant";
import { routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";
import { warehouseSourceWhere } from "@/lib/warehouse";

export async function GET() {
  try {
    await requireTenantSession();
    const warehouses = await prisma.warehouse.findMany({
      where: { isActive: true, ...warehouseSourceWhere() },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        postalCode: true,
        country: true,
      },
    });

    return Response.json({ ok: true, data: warehouses });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
