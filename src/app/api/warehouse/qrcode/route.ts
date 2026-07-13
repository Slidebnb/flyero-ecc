import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { inventoryScopeForUser } from "@/lib/logistics";
import { Permission, requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { requireActiveTenantMembership } from "@/lib/tenantPolicy";
import { warehouseQrSchema } from "@/lib/validators";
import { createQrPayload, createQrPngDataUrl, logWarehouseHistory } from "@/lib/warehouse";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_OPERATIONS_MANAGE);
    if (session.role !== UserRole.ADMIN) await requireActiveTenantMembership(session);
    const parsed = warehouseQrSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    const inventory = await prisma.warehouseInventory.findFirst({
      where: { id: parsed.data.inventoryId, ...inventoryScopeForUser(session) },
      include: { order: true, warehouseLocation: true },
    });
    if (!inventory) return errorResponse("Lagerbestand wurde nicht gefunden.", 404);
    const warehouseId = inventory.warehouseLocation?.warehouseId ?? "unassigned";
    const payload = createQrPayload({
      orderNumber: inventory.order.orderNumber,
      inventoryId: inventory.id,
      warehouseId,
    });
    const updated = await prisma.warehouseInventory.update({
      where: { id: inventory.id },
      data: { qrCode: payload, qrCodePngDataUrl: await createQrPngDataUrl(payload) },
    });
    await logWarehouseHistory({
      inventoryId: inventory.id,
      action: "warehouse.qr_generated",
      userId: session.id,
      oldValue: { qrCode: inventory.qrCode },
      newValue: { qrCode: payload },
    });
    await createAuditLog({
      userId: session.id,
      action: "warehouse.qr_generated",
      entityType: "WarehouseInventory",
      entityId: inventory.id,
      oldValues: { qrCode: inventory.qrCode },
      newValues: { qrCode: payload },
    });
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/warehouse/inventory/${inventory.id}`, request.url), { status: 303 });
    }
    return Response.json({ ok: true, data: updated });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
