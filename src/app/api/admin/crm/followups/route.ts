import { getCrmFollowups } from "@/lib/crm";
import { leadScopeFromSession } from "@/lib/leadScope";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET() {
  try {
    const session = await requirePermission(Permission.CRM_VIEW);
    return successResponse(await getCrmFollowups(leadScopeFromSession(session)));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
