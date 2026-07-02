import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { listCrmLeads, parseLeadListFilters } from "@/lib/crm";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET(request: NextRequest) {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const filters = parseLeadListFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const leads = await listCrmLeads(filters);
    return successResponse({ filters, leads });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
