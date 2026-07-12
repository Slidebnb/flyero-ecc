import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { assignOrderToDistributor } from "@/lib/dispatch";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { adminDispatchAssignSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const parsed = adminDispatchAssignSchema.safeParse(await readBody(request));

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    }

    const assignment = await assignOrderToDistributor({
      orderId: id,
      distributorId: parsed.data.distributorId,
      adminUserId: session.id,
      tenantId: session.role === UserRole.ADMIN ? undefined : session.tenantId,
    });

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL("/admin/dispatch", request.url), { status: 303 });
    }

    return Response.json({ ok: true, data: assignment });
  } catch (error) {
    try {
      return routeErrorResponse(error);
    } catch {
      return errorResponse(error instanceof Error ? error.message : "Zuweisung fehlgeschlagen.", 400);
    }
  }
}
