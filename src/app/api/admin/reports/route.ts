import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const reports = await prisma.report.findMany({
      include: { order: { include: { customer: true } }, tour: true, customer: true },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json({ ok: true, data: reports });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
