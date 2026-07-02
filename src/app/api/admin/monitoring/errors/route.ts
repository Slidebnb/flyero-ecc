import { ErrorSeverity, ErrorStatus, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET(request: NextRequest) {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const severity = params.get("severity");
    const source = params.get("source")?.trim();

    const errors = await prisma.errorLog.findMany({
      where: {
        ...(status && Object.values(ErrorStatus).includes(status as ErrorStatus) ? { status: status as ErrorStatus } : {}),
        ...(severity && Object.values(ErrorSeverity).includes(severity as ErrorSeverity) ? { severity: severity as ErrorSeverity } : {}),
        ...(source ? { source: { contains: source, mode: "insensitive" } } : {}),
      },
      include: { resolvedBy: { select: { email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return successResponse(errors);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
