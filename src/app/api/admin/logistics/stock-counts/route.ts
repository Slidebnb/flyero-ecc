import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createWarehouseStockCount } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { warehouseStockCountCreateSchema } from "@/lib/validators";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const counts = await prisma.warehouseStockCount.findMany({
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
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const parsed = warehouseStockCountCreateSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    return successResponse(await createWarehouseStockCount({ ...parsed.data, countedById: session.id }), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
