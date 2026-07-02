import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { updateWarehouseTransfer } from "@/lib/logistics";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { warehouseTransferUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const parsed = warehouseTransferUpdateSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    return successResponse(await updateWarehouseTransfer({ id, actor: session, ...parsed.data }));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  return PATCH(request, context);
}
