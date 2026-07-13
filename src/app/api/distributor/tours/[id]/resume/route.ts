import { Permission, requirePermission } from "@/lib/permissions";
import { errorResponse } from "@/lib/request";
import { resumeTour } from "@/lib/tours";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteProps) {
  try {
    const session = await requirePermission(Permission.DISTRIBUTOR_OPERATIONS_MANAGE);
    const { id } = await params;
    return Response.json({ ok: true, data: await resumeTour({ tourId: id, userId: session.id }) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Fortsetzen fehlgeschlagen.", 400);
  }
}
