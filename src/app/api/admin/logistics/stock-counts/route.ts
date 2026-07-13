import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { createWarehouseStockCount } from "@/lib/logistics";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { warehouseStockCountCreateSchema } from "@/lib/validators";

export async function GET() {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_VIEW);
    const counts = await prisma.warehouseStockCount.findMany({
      where: session.role === UserRole.ADMIN ? {} : { inventory: { order: { tenantId: session.tenantId ?? "__no_tenant__" } } },
      include: { warehouse: true, inventory: { include: { order: true } }, countedBy: true },
      orderBy: { countedAt: "desc" },
      take: 200,
    });
    return successResponse(counts);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_MANAGE);
    const parsed = warehouseStockCountCreateSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    return successResponse(await createWarehouseStockCount({ ...parsed.data, countedById: session.id, tenantId: session.role === UserRole.ADMIN ? undefined : session.tenantId }), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
