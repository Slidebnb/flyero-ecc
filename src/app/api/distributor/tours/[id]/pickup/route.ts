import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { errorResponse, readBody } from "@/lib/request";
import { tourPickupSchema } from "@/lib/validators";
import { confirmPickup } from "@/lib/tours";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const session = await requireRole([UserRole.DISTRIBUTOR]);
    const parsed = tourPickupSchema.safeParse(await readBody(request as never));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    const { id } = await params;
    const tour = await confirmPickup({ tourId: id, userId: session.id, qrCode: parsed.data.qrCode });
    return Response.json({ ok: true, data: tour });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Abholung fehlgeschlagen.", 400);
  }
}
