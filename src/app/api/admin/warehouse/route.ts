import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN]);
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
