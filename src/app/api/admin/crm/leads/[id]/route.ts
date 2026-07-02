import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { requireRole } from "@/lib/auth";
import { getCrmLead, updateCrmLead } from "@/lib/crm";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const lead = await getCrmLead(id);
    if (!lead) return errorResponse("Lead wurde nicht gefunden.", 404);
    return successResponse(lead);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const lead = await updateCrmLead(id, await readBody(request), session.id);
    return successResponse(lead);
  } catch (error) {
    if (error instanceof ZodError) return errorResponse("Lead-Aktualisierung ist ungültig.", 400);
    if (error instanceof Error && error.message === "Lead wurde nicht gefunden.") return errorResponse(error.message, 404);
    return routeErrorResponse(error);
  }
}
