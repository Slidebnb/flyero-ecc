import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { listPrintOrders } from "@/lib/documents";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET() {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    return successResponse(await listPrintOrders(session));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
