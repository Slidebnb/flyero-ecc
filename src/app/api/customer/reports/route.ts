import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireRole([UserRole.CUSTOMER]);
    const reports = await prisma.report.findMany({
      where: {
        status: { in: ["GENERATED", "APPROVED", "PUBLISHED"] },
        order: { customer: { userId: session.id } },
        tour: { status: "APPROVED" },
      },
      include: {
        order: true,
        tour: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json({ ok: true, data: reports });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
