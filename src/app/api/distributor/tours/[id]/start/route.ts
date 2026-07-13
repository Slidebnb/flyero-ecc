import { Permission, requirePermission } from "@/lib/permissions";
import { errorResponse, readBody } from "@/lib/request";
import { tourGpsPointSchema } from "@/lib/validators";
import { startTour } from "@/lib/tours";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const session = await requirePermission(Permission.DISTRIBUTOR_OPERATIONS_MANAGE);
    const body = await readBody(request as never);
    const parsed = tourGpsPointSchema.partial().safeParse(body);
    const { id } = await params;
    const hasPoint = parsed.success && parsed.data.lat !== undefined && parsed.data.lng !== undefined;
    const tour = await startTour({
      tourId: id,
      userId: session.id,
      firstPoint: hasPoint ? parsed.data as never : undefined,
    });
    return Response.json({ ok: true, data: tour });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Tourstart fehlgeschlagen.", 400);
  }
}
