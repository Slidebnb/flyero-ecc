import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";
import { productionInventoryWhere } from "@/lib/productionData";
import { warehouseSourceWhere } from "@/lib/warehouse";

export async function GET() {
  try {
    await requirePermission(Permission.PLATFORM_SETTINGS_MANAGE);
    const source = warehouseSourceWhere();
    const inventory = await prisma.warehouseInventory.findMany({
      where: { ...productionInventoryWhere(), ...(Object.keys(source).length ? { OR: [{ warehouse: source }, { warehouseId: null }] } : {}) },
      include: {
        order: { include: { customer: true } },
        warehouseLocation: { include: { warehouse: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ ok: true, data: inventory });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
