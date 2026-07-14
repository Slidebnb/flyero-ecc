import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { assignOrderToDistributor } from "@/lib/dispatch";
import { Permission, requirePermission } from "@/lib/permissions";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { adminDispatchAssignSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.DISPATCH_ASSIGN);
    const { id } = await context.params;
    const parsed = adminDispatchAssignSchema.safeParse(await readBody(request));

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    }

    const assignment = await assignOrderToDistributor({
      orderId: id,
      distributorId: parsed.data.distributorId,
      segmentId: parsed.data.segmentId,
      adminUserId: session.id,
      tenantId: session.role === UserRole.ADMIN ? undefined : session.tenantId,
    });

    if (request.headers.get("accept")?.includes("text/html")) {
      const returnTo = parsed.data.returnTo ?? `/admin/orders/${id}?assignment=success`;
      const destination = new URL(returnTo, request.url);
      if (!destination.pathname.startsWith("/admin/orders/") && destination.pathname !== "/admin/dispatch") {
        return NextResponse.redirect(new URL(`/admin/orders/${id}?assignment=success`, request.url), { status: 303 });
      }
      return NextResponse.redirect(destination, { status: 303 });
    }

    return Response.json({ ok: true, data: assignment });
  } catch (error) {
    if (request.headers.get("accept")?.includes("text/html")) {
      const { id } = await context.params;
      const message = error instanceof Error ? error.message : "Zuweisung fehlgeschlagen.";
      return NextResponse.redirect(new URL(`/admin/orders/${id}?assignment=error&message=${encodeURIComponent(message)}`, request.url), { status: 303 });
    }
    try {
      return routeErrorResponse(error);
    } catch {
      return errorResponse(error instanceof Error ? error.message : "Zuweisung fehlgeschlagen.", 400);
    }
  }
}
