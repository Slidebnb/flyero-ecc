import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { resolveErrorLog } from "@/lib/monitoring";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const body = (await readBody(request)) as Record<string, unknown>;
    const resolutionNote = typeof body.resolutionNote === "string" ? body.resolutionNote : undefined;

    return successResponse(await resolveErrorLog(id, session.id, resolutionNote));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
