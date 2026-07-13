import { NextRequest, NextResponse } from "next/server";
import { Permission, requirePermission } from "@/lib/permissions";
import { rejectDispatchOrder } from "@/lib/dispatch";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { distributorDispatchRejectSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.DISTRIBUTOR_OPERATIONS_MANAGE);
    const { id } = await context.params;
    const parsed = distributorDispatchRejectSchema.safeParse(await readBody(request));

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    }

    const assignment = await rejectDispatchOrder({
      orderId: id,
      distributorUserId: session.id,
      reason: parsed.data.reason,
      note: parsed.data.note,
    });

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL("/distributor/dashboard", request.url), { status: 303 });
    }

    return Response.json({ ok: true, data: assignment });
  } catch (error) {
    try {
      return routeErrorResponse(error);
    } catch {
      return errorResponse(error instanceof Error ? error.message : "Ablehnung fehlgeschlagen.", 400);
    }
  }
}
