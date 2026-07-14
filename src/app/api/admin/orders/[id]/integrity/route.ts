import { Permission, requirePermission } from "@/lib/permissions";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { getOrderIntegrityCheck } from "@/lib/orderIntegrity";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(Permission.ORDER_MANAGE);
    const { id } = await context.params;
    const integrity = await getOrderIntegrityCheck(id);
    return Response.json({ ok: true, data: integrity });
  } catch (error) {
    if (error instanceof Error && error.message === "Auftrag wurde nicht gefunden.") return errorResponse(error.message, 404);
    return routeErrorResponse(error);
  }
}
