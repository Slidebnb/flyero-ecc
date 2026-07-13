import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { assignLead } from "@/lib/crm";
import { leadScopeFromSession } from "@/lib/leadScope";
import { Permission, requirePermission } from "@/lib/permissions";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.CRM_ASSIGN);
    const { id } = await context.params;
    const lead = await assignLead(id, await readBody(request), session.id, leadScopeFromSession(session));
    return successResponse(lead);
  } catch (error) {
    if (error instanceof ZodError) return errorResponse("Zuweisung ist ungültig.", 400);
    if (error instanceof Error && error.message === "Lead wurde nicht gefunden.") return errorResponse(error.message, 404);
    return routeErrorResponse(error);
  }
}
