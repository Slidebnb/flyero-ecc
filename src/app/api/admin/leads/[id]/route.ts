import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { requireRole } from "@/lib/auth";
import { updateLead } from "@/lib/leads";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function handleUpdate(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const lead = await updateLead(id, await readBody(request), session.id);

    return successResponse(lead);
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse("Lead-Aktualisierung ist ungültig.", 400);
    }

    if (error instanceof Error && error.message === "Lead wurde nicht gefunden.") {
      return errorResponse(error.message, 404);
    }

    return routeErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleUpdate(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleUpdate(request, context);
}
