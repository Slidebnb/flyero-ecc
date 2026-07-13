import { NextRequest } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

function warehouseUpdateData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const field of ["name", "city", "postalCode", "openingHours", "contactPerson", "contactPhone", "contactEmail"]) {
    if (body[field] !== undefined) data[field] = String(body[field] ?? "").trim();
  }
  if (body.street !== undefined || body.houseNumber !== undefined || body.city !== undefined || body.postalCode !== undefined) {
    data.address = {
      street: String(body.street ?? "").trim(),
      houseNumber: String(body.houseNumber ?? "").trim(),
      postalCode: String(body.postalCode ?? "").trim(),
      city: String(body.city ?? "").trim(),
      country: String(body.country ?? "DE").trim(),
    };
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.isDefault !== undefined) data.isDefault = Boolean(body.isDefault);
  return data;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_MANAGE);
    const { id } = await context.params;
    const body = await readBody(request) as Record<string, unknown>;
    const before = await prisma.warehouse.findUnique({ where: { id } });
    if (!before) throw new Error("Lager wurde nicht gefunden.");
    const data = warehouseUpdateData(body);
    const warehouse = await prisma.$transaction(async (tx) => {
      if (data.isDefault === true) await tx.warehouse.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
      return tx.warehouse.update({ where: { id }, data });
    });
    await createAuditLog({ userId: session.id, action: "settings.warehouse_updated", entityType: "Warehouse", entityId: warehouse.id, oldValues: before, newValues: warehouse });
    await notifyAdmins({ type: "WAREHOUSE_CHANGED", title: "Lager geaendert", message: `${warehouse.name} wurde aktualisiert.` });
    return successResponse(warehouse);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
