import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { errorResponse, readBody } from "@/lib/request";
import { saveTourAdminNote } from "@/lib/tours";
import { adminTourNoteSchema } from "@/lib/validators";

type RouteProps = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const parsed = adminTourNoteSchema.safeParse(await readBody(request as never));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    const { id } = await params;
    const data = await saveTourAdminNote({ tourId: id, adminUserId: session.id, ...parsed.data });
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/admin/tours/${id}`, request.url), { status: 303 });
    }
    return Response.json({ ok: true, data });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Notiz konnte nicht gespeichert werden.", 400);
  }
}

export async function POST(request: Request, props: RouteProps) {
  return PATCH(request, props);
}
