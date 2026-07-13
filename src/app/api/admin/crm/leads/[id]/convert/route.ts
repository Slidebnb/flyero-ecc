import { NextRequest } from "next/server";
import { convertLeadToCustomer } from "@/lib/crm";
import { leadScopeFromSession } from "@/lib/leadScope";
import { Permission, requirePermission } from "@/lib/permissions";
import { errorResponse, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.CRM_CONVERT);
    const { id } = await context.params;
    const result = await convertLeadToCustomer(id, session.id, leadScopeFromSession(session));
    return successResponse(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Lead wurde nicht gefunden.") return errorResponse(error.message, 404);
    return routeErrorResponse(error);
  }
}
