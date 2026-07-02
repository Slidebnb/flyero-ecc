import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { routeErrorResponse, successResponse } from "@/lib/request";
import { getGoogleMapsConfigStatus } from "@/lib/settings";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN]);
    return successResponse(await getGoogleMapsConfigStatus());
  } catch (error) {
    return routeErrorResponse(error);
  }
}
