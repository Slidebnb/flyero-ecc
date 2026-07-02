import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { refundPayment } from "@/lib/payments";
import { readBody, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const { id } = await context.params;
    const body = await readBody(request);
    const amount = body.amount ? Number(body.amount) : null;
    const reason = typeof body.reason === "string" ? body.reason : null;
    const refund = await refundPayment({ paymentId: id, adminUserId: session.id, amount, reason });

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL("/admin/payments", request.url), { status: 303 });
    }

    return Response.json({ ok: true, data: refund });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
