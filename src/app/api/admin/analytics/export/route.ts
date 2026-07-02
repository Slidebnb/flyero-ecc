import { UserRole } from "@prisma/client";
import { analyticsRowsToCsv, getAnalyticsExportRows, parseAnalyticsFilters } from "@/lib/analytics";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { routeErrorResponse } from "@/lib/request";

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
    const rows = await getAnalyticsExportRows(filters);
    await createAuditLog({
      userId: session.id,
      action: "analytics.exported",
      entityType: "Analytics",
      entityId: "export",
      newValues: { filters, rowCount: rows.length },
    });
    return new Response(analyticsRowsToCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="flyero-analytics-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
