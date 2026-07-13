import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";
import { getPaymentConfigStatus } from "@/lib/settings";

export async function GET() {
  try {
    await requirePermission(Permission.PLATFORM_SETTINGS_MANAGE);
    return successResponse(await getPaymentConfigStatus());
  } catch (error) {
    return routeErrorResponse(error);
  }
}
