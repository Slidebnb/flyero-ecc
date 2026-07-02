import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";

export async function GET() {
  try {
    const session = await requireRole([UserRole.DISTRIBUTOR]);
    const profile = await prisma.distributorProfile.findUnique({
      where: { userId: session.id },
      select: { id: true },
    });

    if (!profile) {
      return Response.json({ ok: true, data: [] });
    }

    const assignments = await prisma.dispatchAssignment.findMany({
      where: { distributorId: profile.id, status: "ASSIGNED" },
      include: {
        order: { include: { customer: true } },
        inventory: { include: { warehouseLocation: { include: { warehouse: true } } } },
      },
      orderBy: { assignedAt: "desc" },
    });

    return Response.json({ ok: true, data: assignments });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
