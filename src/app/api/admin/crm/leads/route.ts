import { NextRequest } from "next/server";
import { listCrmLeads, parseLeadListFilters } from "@/lib/crm";
import { leadScopeFromSession } from "@/lib/leadScope";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.CRM_VIEW);
    const filters = parseLeadListFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const leads = await listCrmLeads(filters, leadScopeFromSession(session));
    return successResponse({ filters, leads });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
