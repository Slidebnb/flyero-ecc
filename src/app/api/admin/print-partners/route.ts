import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createPrintPartner, listPrintPartners } from "@/lib/documents";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    return successResponse(await listPrintPartners());
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    return successResponse(await createPrintPartner(session, await readBody(request)), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
