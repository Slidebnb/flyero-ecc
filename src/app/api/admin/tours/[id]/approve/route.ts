import { NextResponse } from "next/server";
import { errorResponse, readBody } from "@/lib/request";
import { approveTour } from "@/lib/tours";
import { adminTourReviewSchema } from "@/lib/validators";
import { Permission, requirePermission } from "@/lib/permissions";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const session = await requirePermission(Permission.TOUR_MANAGE);
    const parsed = adminTourReviewSchema.safeParse(await readBody(request as never));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    const { id } = await params;
    const data = await approveTour({ tourId: id, adminUserId: session.id, ...parsed.data });
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/admin/tours/${id}`, request.url), { status: 303 });
    }
    return Response.json({ ok: true, data });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Freigabe fehlgeschlagen.", 400);
  }
}
