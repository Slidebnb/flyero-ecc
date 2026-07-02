import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getCrmFollowups } from "@/lib/crm";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    return successResponse(await getCrmFollowups());
  } catch (error) {
    return routeErrorResponse(error);
  }
}
