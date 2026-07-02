import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { errorResponse, readBody } from "@/lib/request";
import { tourPhotoSchema } from "@/lib/validators";
import { uploadTourPhoto } from "@/lib/tours";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const session = await requireRole([UserRole.DISTRIBUTOR]);
    const parsed = tourPhotoSchema.safeParse(await readBody(request as never));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Foto-Daten.");
    const { id } = await params;
    return Response.json({ ok: true, data: await uploadTourPhoto({ tourId: id, userId: session.id, ...parsed.data }) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Foto-Upload fehlgeschlagen.", 400);
  }
}
