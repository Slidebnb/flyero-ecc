import { TransferStatus, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { createWarehouseTransfer } from "@/lib/logistics";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { warehouseTransferCreateSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_VIEW);
    const status = request.nextUrl.searchParams.get("status") as TransferStatus | null;
    const transfers = await prisma.warehouseTransfer.findMany({
      where: { ...(session.role === UserRole.ADMIN ? {} : { inventory: { order: { tenantId: session.tenantId ?? "__no_tenant__" } } }), ...(status ? { status } : {}) },
      include: { fromWarehouse: true, toWarehouse: true, inventory: { include: { order: true } }, requestedBy: true, approvedBy: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return successResponse(transfers);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_MANAGE);
    const parsed = warehouseTransferCreateSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    return successResponse(await createWarehouseTransfer({ ...parsed.data, actorId: session.id, tenantId: session.role === UserRole.ADMIN ? undefined : session.tenantId }), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
