import { getBusinessOverview, parseAnalyticsFilters } from "@/lib/analytics";
import { createAuditLog } from "@/lib/audit";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";

function filtersFromUrl(request: Request) {
  const url = new URL(request.url);
  return parseAnalyticsFilters({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    city: url.searchParams.get("city"),
    customerId: url.searchParams.get("customerId"),
    distributorId: url.searchParams.get("distributorId"),
    status: url.searchParams.get("status"),
  });
}

export async function GET(request: Request) {
  try {
    const session = await requirePermission(Permission.ANALYTICS_VIEW);
    const filters = filtersFromUrl(request);
    const data = await getBusinessOverview(filters);
    await createAuditLog({
      userId: session.id,
      action: "analytics.viewed",
      entityType: "Analytics",
      entityId: "overview",
      newValues: { filters },
    });
    return successResponse(data);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
