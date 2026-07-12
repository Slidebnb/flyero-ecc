import { PaymentDisputeStatus } from "@prisma/client";
import { z } from "zod";
import { Permission, requirePermission } from "@/lib/permissions";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  status: z.nativeEnum(PaymentDisputeStatus).optional(),
  adminNote: z.string().trim().max(4000).nullable().optional(),
  resolutionNote: z.string().trim().max(4000).nullable().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requirePermission(Permission.PAYMENT_DISPUTE_MANAGE);
    const { id } = await context.params;
    const input = updateSchema.parse(await readBody(request as never));
    const current = await prisma.paymentDispute.findUnique({ where: { id } });
    if (!current) return Response.json({ ok: false, error: "Zahlungsstreitfall wurde nicht gefunden." }, { status: 404 });
    const updated = await prisma.paymentDispute.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status, resolvedAt: input.status === PaymentDisputeStatus.OPEN ? null : new Date() } : {}),
        ...(input.adminNote !== undefined ? { adminNote: input.adminNote } : {}),
        ...(input.resolutionNote !== undefined ? { resolutionNote: input.resolutionNote } : {}),
      },
    });
    await createAuditLog({
      userId: actor.id,
      tenantId: current.tenantId,
      action: "payment.dispute.updated",
      entityType: "PaymentDispute",
      entityId: current.id,
      oldValues: { status: current.status, adminNote: current.adminNote, resolutionNote: current.resolutionNote },
      newValues: { status: updated.status, adminNote: updated.adminNote, resolutionNote: updated.resolutionNote },
    });
    return successResponse(updated);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
