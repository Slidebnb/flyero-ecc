import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { acceptDispatchOrder } from "@/lib/dispatch";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.DISTRIBUTOR]);
    const { id } = await context.params;
    const assignment = await acceptDispatchOrder({ orderId: id, distributorUserId: session.id });

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL("/distributor/dashboard", request.url), { status: 303 });
    }

    return Response.json({ ok: true, data: assignment });
  } catch (error) {
    try {
      return routeErrorResponse(error);
    } catch {
      return errorResponse(error instanceof Error ? error.message : "Annahme fehlgeschlagen.", 400);
    }
  }
}
