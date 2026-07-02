import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { adminOrderNoteSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const { id } = await context.params;
    const parsed = adminOrderNoteSchema.safeParse(await readBody(request));

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return errorResponse("Auftrag wurde nicht gefunden.", 404);
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        adminInternalNotes: parsed.data.adminInternalNotes || null,
        adminCustomerMessage: parsed.data.adminCustomerMessage || null,
      },
    });

    await createAuditLog({
      userId: session.id,
      action: "admin.note_added",
      entityType: "Order",
      entityId: id,
      oldValues: {
        adminInternalNotes: order.adminInternalNotes,
        adminCustomerMessage: order.adminCustomerMessage,
      },
      newValues: {
        adminInternalNotes: updated.adminInternalNotes,
        adminCustomerMessage: updated.adminCustomerMessage,
      },
    });

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/admin/orders/${id}`, request.url), {
        status: 303,
      });
    }

    return Response.json({ ok: true, data: updated });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  return PATCH(request, context);
}
