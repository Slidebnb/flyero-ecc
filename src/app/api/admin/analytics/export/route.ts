import { analyticsRowsToCsv, getAnalyticsExportRows, parseAnalyticsFilters } from "@/lib/analytics";
import { createAuditLog } from "@/lib/audit";
import { Permission, requirePermission } from "@/lib/permissions";
import { privateDownloadHeaders } from "@/lib/downloadHeaders";
import { routeErrorResponse } from "@/lib/request";

export async function GET(request: Request) {
  try {
    const session = await requirePermission(Permission.ANALYTICS_EXPORT);
    const url = new URL(request.url);
    const filters = parseAnalyticsFilters({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      city: url.searchParams.get("city"),
      customerId: url.searchParams.get("customerId"),
      distributorId: url.searchParams.get("distributorId"),
      status: url.searchParams.get("status"),
    });
    const rows = await getAnalyticsExportRows(filters, { tenantId: session.tenantId });
    await createAuditLog({
      userId: session.id,
      action: "analytics.exported",
      entityType: "Analytics",
      entityId: "export",
      newValues: { filters, rowCount: rows.length },
    });
    return new Response(analyticsRowsToCsv(rows), {
      headers: privateDownloadHeaders({ contentType: "text/csv; charset=utf-8", filename: `flyero-analytics-${new Date().toISOString().slice(0, 10)}.csv` }),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
