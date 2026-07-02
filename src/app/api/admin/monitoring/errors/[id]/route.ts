import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const error = await prisma.errorLog.findUnique({
      where: { id },
      include: { resolvedBy: { select: { email: true, role: true } } },
    });

    if (!error) return errorResponse("Fehlerlog wurde nicht gefunden.", 404);

    return successResponse(error);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
