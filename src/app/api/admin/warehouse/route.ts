import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";

export async function GET() {
  try {
    await requirePermission(Permission.PLATFORM_SETTINGS_MANAGE);
    const inventory = await prisma.warehouseInventory.findMany({
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
