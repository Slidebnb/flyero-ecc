import { ReviewStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const payloadSchema = z.object({
  customerVisible: z.boolean().optional(),
  reviewStatus: z.enum(["PENDING", "APPROVED", "REJECTED", "NEEDS_REVIEW"]).optional(),
  caption: z.string().max(240).optional(),
  internalNote: z.string().max(1000).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const parsed = payloadSchema.parse(await request.json());
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
