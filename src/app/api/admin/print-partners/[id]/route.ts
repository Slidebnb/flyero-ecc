import { NextRequest } from "next/server";
import { Permission, requirePermission } from "@/lib/permissions";
import { updatePrintPartner } from "@/lib/documents";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.PRINT_PARTNER_MANAGE);
    const { id } = await context.params;
    return successResponse(await updatePrintPartner(session, id, await readBody(request)));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
