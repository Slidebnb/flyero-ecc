import { Permission, requirePermission } from "@/lib/permissions";
import { errorResponse } from "@/lib/request";
import { pauseTour } from "@/lib/tours";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteProps) {
  try {
    const session = await requirePermission(Permission.DISTRIBUTOR_OPERATIONS_MANAGE);
    const { id } = await params;
    return Response.json({ ok: true, data: await pauseTour({ tourId: id, userId: session.id }) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Pause fehlgeschlagen.", 400);
  }
}
