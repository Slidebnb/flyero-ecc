import { requireApprovedDistributor } from "@/lib/distributorAccess";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";
import { distributorInventorySelect, distributorOrderSelect } from "@/lib/distributorPrivacy";

export async function GET() {
  try {
    const { profile } = await requireApprovedDistributor();

    const assignments = await prisma.dispatchAssignment.findMany({
      where: { distributorId: profile.id, status: "ASSIGNED" },
      include: {
        order: { select: distributorOrderSelect },
        inventory: { select: distributorInventorySelect },
      },
      orderBy: { assignedAt: "desc" },
    });

    return Response.json({ ok: true, data: assignments });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
