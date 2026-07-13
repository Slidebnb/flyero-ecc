import { NextRequest } from "next/server";
import { Permission, requirePermission } from "@/lib/permissions";
import { createPrintPartner, listPrintPartners } from "@/lib/documents";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

export async function GET() {
  try {
    await requirePermission(Permission.PRINT_PARTNER_VIEW);
    return successResponse(await listPrintPartners());
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.PRINT_PARTNER_MANAGE);
    return successResponse(await createPrintPartner(session, await readBody(request)), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
