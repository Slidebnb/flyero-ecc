import { NextResponse } from "next/server";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { adminTourAssignSchema } from "@/lib/validators";
import { assignTour } from "@/lib/tours";
import { prisma } from "@/lib/prisma";
import { Permission, requirePermission } from "@/lib/permissions";
import { productionTourWhere } from "@/lib/productionData";

export async function GET() {
  try {
    await requirePermission(Permission.TOUR_VIEW);
    const tours = await prisma.distributionTour.findMany({
      where: productionTourWhere(),
      include: {
        distributor: {
          include: { user: { select: { id: true, email: true, status: true } } },
        },
        order: {
          include: {
            customer: { select: { id: true, companyName: true, userId: true } },
          },
        },
        inventory: { include: { warehouseLocation: { include: { warehouse: true } } } },
        gpsPoints: true,
        photoProofs: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json({ ok: true, data: tours });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission(Permission.TOUR_MANAGE);
    const parsed = adminTourAssignSchema.safeParse(await readBody(request as never));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    const tour = await assignTour({ ...parsed.data, adminUserId: session.id });
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/admin/tours/${tour.id}`, request.url), { status: 303 });
    }
    return Response.json({ ok: true, data: tour }, { status: 201 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Zuweisung fehlgeschlagen.", 400);
  }
}
