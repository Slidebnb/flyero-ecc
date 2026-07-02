import { UserRole } from "@prisma/client";
import { getOrderMetrics, parseAnalyticsFilters } from "@/lib/analytics";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET(request: Request) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const url = new URL(request.url);
    const filters = parseAnalyticsFilters({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      city: url.searchParams.get("city"),
      customerId: url.searchParams.get("customerId"),
      distributorId: url.searchParams.get("distributorId"),
      status: url.searchParams.get("status"),
    });
    await createAuditLog({ userId: session.id, action: "analytics.viewed", entityType: "Analytics", entityId: "orders", newValues: { filters } });
    return successResponse(await getOrderMetrics(filters));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
