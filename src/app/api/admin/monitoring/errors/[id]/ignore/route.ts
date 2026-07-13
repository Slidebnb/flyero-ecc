import { NextRequest } from "next/server";
import { ignoreErrorLog } from "@/lib/monitoring";
import { Permission, requirePermission } from "@/lib/permissions";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.MONITORING_MANAGE);
    const { id } = await context.params;
    const body = (await readBody(request)) as Record<string, unknown>;
    const resolutionNote = typeof body.resolutionNote === "string" ? body.resolutionNote : undefined;

    return successResponse(await ignoreErrorLog(id, session.id, resolutionNote));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
