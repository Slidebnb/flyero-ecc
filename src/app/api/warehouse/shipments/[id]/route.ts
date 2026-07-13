import { NextRequest } from "next/server";
import { updateLogisticsShipment } from "@/lib/logistics";
import { Permission, requirePermission } from "@/lib/permissions";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { logisticsShipmentUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_OPERATIONS_MANAGE);
    const { id } = await context.params;
    const parsed = logisticsShipmentUpdateSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    return successResponse(await updateLogisticsShipment({ id, actor: session, ...parsed.data }));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  return PATCH(request, context);
}
