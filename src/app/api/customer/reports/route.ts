import { requireTenantSession } from "@/lib/tenant";
import { routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireTenantSession();
    const reports = await prisma.report.findMany({
      where: {
        tenantId: session.tenantId,
        status: "PUBLISHED",
        order: { tenantId: session.tenantId, customer: { userId: session.id, tenantId: session.tenantId } },
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
