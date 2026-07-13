import { Permission, requirePermission } from "@/lib/permissions";
import { errorResponse, readBody } from "@/lib/request";
import { tourCompleteSchema } from "@/lib/validators";
import { completeTour } from "@/lib/tours";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const session = await requirePermission(Permission.DISTRIBUTOR_OPERATIONS_MANAGE);
    const parsed = tourCompleteSchema.safeParse(await readBody(request as never));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    const { id } = await params;
    return Response.json({ ok: true, data: await completeTour({ tourId: id, userId: session.id, ...parsed.data }) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Tourabschluss fehlgeschlagen.", 400);
  }
}
