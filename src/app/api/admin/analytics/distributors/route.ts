import { getDistributorMetrics, parseAnalyticsFilters } from "@/lib/analytics";
import { Permission, requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET(request: Request) {
  try {
    const session = await requirePermission(Permission.ANALYTICS_VIEW);
    const url = new URL(request.url);
    const filters = parseAnalyticsFilters({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      city: url.searchParams.get("city"),
      customerId: url.searchParams.get("customerId"),
      distributorId: url.searchParams.get("distributorId"),
      status: url.searchParams.get("status"),
    });
    await createAuditLog({ userId: session.id, action: "analytics.viewed", entityType: "Analytics", entityId: "distributors", newValues: { filters } });
    return successResponse(await getDistributorMetrics(filters));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
