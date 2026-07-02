import { ErrorSeverity, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createErrorLogFromUnknown } from "@/lib/monitoring";
import { errorResponse, readBody } from "@/lib/request";
import { tourGpsUploadSchema } from "@/lib/validators";
import { uploadGpsPoints } from "@/lib/tours";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteProps) {
  try {
    const session = await requireRole([UserRole.DISTRIBUTOR]);
    const parsed = tourGpsUploadSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige GPS-Daten.");
    const { id } = await params;
    return Response.json({ ok: true, data: await uploadGpsPoints({ tourId: id, userId: session.id, points: parsed.data.points }) });
  } catch (error) {
    await createErrorLogFromUnknown(error, {
      severity: ErrorSeverity.MEDIUM,
      source: "tour.gps_upload",
      fallbackMessage: "GPS-Upload fehlgeschlagen.",
    });
    return errorResponse(error instanceof Error ? error.message : "GPS-Upload fehlgeschlagen.", 400);
  }
}
