import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { adminTourAssignSchema } from "@/lib/validators";
import { assignTour } from "@/lib/tours";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN]);
    const tours = await prisma.distributionTour.findMany({
      include: {
        distributor: { include: { user: true } },
        order: { include: { customer: true } },
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
    const session = await requireRole([UserRole.ADMIN]);
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
