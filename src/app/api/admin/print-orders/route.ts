import { Permission, requirePermission } from "@/lib/permissions";
import { listPrintOrders } from "@/lib/documents";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET() {
  try {
    const session = await requirePermission(Permission.PRINT_ORDER_VIEW);
    return successResponse(await listPrintOrders(session));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
