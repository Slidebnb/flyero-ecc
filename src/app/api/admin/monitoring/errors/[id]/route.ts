import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse, successResponse } from "@/lib/request";
import { productionErrorLogWhere } from "@/lib/productionData";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(Permission.MONITORING_VIEW);
    const { id } = await context.params;
    const error = await prisma.errorLog.findFirst({
      where: { id, ...productionErrorLogWhere() },
      include: { resolvedBy: { select: { email: true, role: true } } },
    });

    if (!error) return errorResponse("Fehlerlog wurde nicht gefunden.", 404);

    return successResponse(error);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
