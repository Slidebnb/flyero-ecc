import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { errorResponse } from "@/lib/request";
import { resumeTour } from "@/lib/tours";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireRole([UserRole.DISTRIBUTOR]);
    const { id } = await params;
    return Response.json({ ok: true, data: await resumeTour({ tourId: id, userId: session.id }) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Fortsetzen fehlgeschlagen.", 400);
  }
}
