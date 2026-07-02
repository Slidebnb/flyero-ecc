import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { requireRole } from "@/lib/auth";
import { addLeadNote } from "@/lib/crm";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const note = await addLeadNote(id, await readBody(request), session.id);
    return successResponse(note, 201);
  } catch (error) {
    if (error instanceof ZodError) return errorResponse("Notiz ist ungültig.", 400);
    if (error instanceof Error && error.message === "Lead wurde nicht gefunden.") return errorResponse(error.message, 404);
    return routeErrorResponse(error);
  }
}
