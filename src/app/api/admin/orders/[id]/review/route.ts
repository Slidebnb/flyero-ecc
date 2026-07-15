import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Permission, requirePermission } from "@/lib/permissions";
import { reviewOrder } from "@/lib/orderReviewWorkflow";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

const reviewSchema = z.object({
  action: z.enum(["approve", "clarification", "reject"]),
  customerMessage: z.string().trim().max(4000).optional(),
  internalNote: z.string().trim().max(4000).optional(),
  rejectionReason: z.string().trim().max(1000).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.ORDER_MANAGE);
    const { id } = await context.params;
    const parsed = reviewSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Ungueltige Review-Aktion.");
    const result = await reviewOrder({
      orderId: id,
      adminUserId: session.id,
      adminTenantId: session.tenantId,
      action: parsed.data.action,
      customerMessage: parsed.data.customerMessage,
      note: parsed.data.internalNote,
      rejectionReason: parsed.data.rejectionReason,
    });
    if (request.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(new URL(`/admin/orders/${id}`, request.url), { status: 303 });
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
