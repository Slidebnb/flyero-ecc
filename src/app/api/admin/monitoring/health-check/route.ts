import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { runHealthCheck } from "@/lib/monitoring";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function POST() {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    return successResponse(await runHealthCheck(session.id), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
