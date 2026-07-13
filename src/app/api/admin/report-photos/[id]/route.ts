import { ReviewStatus } from "@prisma/client";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { approvalRequiresCleanScan } from "@/lib/fileScanning";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";
import { tenantWhereForSession } from "@/lib/tenantPolicy";

type RouteContext = { params: Promise<{ id: string }> };

const payloadSchema = z.object({
  customerVisible: z.boolean().optional(),
  reviewStatus: z.enum(["PENDING", "APPROVED", "REJECTED", "NEEDS_REVIEW"]).optional(),
  caption: z.string().max(240).optional(),
  internalNote: z.string().max(1000).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.DOCUMENT_REVIEW);
    const { id } = await context.params;
    const parsed = payloadSchema.parse(await request.json());
    const current = await prisma.photoProof.findFirst({
      where: { id, order: tenantWhereForSession(session) },
      select: { scanStatus: true },
    });
    if (!current) return Response.json({ ok: false, error: "Nachweisfoto wurde nicht gefunden." }, { status: 404 });
    if ((parsed.customerVisible === true || parsed.reviewStatus === "APPROVED") && approvalRequiresCleanScan({ status: current.scanStatus })) {
      return Response.json({ ok: false, error: "Das Foto darf erst nach erfolgreicher Dateiprüfung freigegeben werden." }, { status: 409 });
    }
    const photo = await prisma.photoProof.update({
      where: { id },
      data: {
        customerVisible: parsed.customerVisible,
        reviewStatus: parsed.reviewStatus as ReviewStatus | undefined,
        caption: parsed.caption,
        internalNote: parsed.internalNote,
        reviewedById: session.id,
        reviewedAt: new Date(),
      },
    });
    await createAuditLog({
      userId: session.id,
      action: "photo.reviewed",
      entityType: "PhotoProof",
      entityId: photo.id,
      newValues: parsed,
    });
    return Response.json({ ok: true, data: photo });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
