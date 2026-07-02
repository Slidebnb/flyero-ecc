import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { convertLeadToCustomer } from "@/lib/crm";
import { errorResponse, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const result = await convertLeadToCustomer(id, session.id);
    return successResponse(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Lead wurde nicht gefunden.") return errorResponse(error.message, 404);
    return routeErrorResponse(error);
  }
}
