import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isProductionRuntime } from "@/lib/productionData";
import { assertSameOrigin, errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { warehouseDeleteReferences, warehouseSourceWhere } from "@/lib/warehouse";

function warehouseUpdateData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const field of ["name", "city", "postalCode", "openingHours", "contactPerson", "contactPhone", "contactEmail", "notes"]) {
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
    if (isProductionRuntime && before.isDemoData) return errorResponse("Dieses Lager ist in der Produktion nicht verfügbar.", 404);
    const data = warehouseUpdateData(body);
    const warehouse = await prisma.$transaction(async (tx) => {
      if (data.isDefault === true) await tx.warehouse.updateMany({ where: { ...warehouseSourceWhere(), id: { not: id } }, data: { isDefault: false } });
      return tx.warehouse.update({ where: { id }, data });
    });
    await createAuditLog({ userId: session.id, action: "settings.warehouse_updated", entityType: "Warehouse", entityId: warehouse.id, oldValues: before, newValues: warehouse });
    await notifyAdmins({ type: "WAREHOUSE_CHANGED", title: "Lager geändert", message: `${warehouse.name} wurde aktualisiert.` });
    return successResponse(warehouse);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_MANAGE);
    assertSameOrigin(request);
    const { id } = await context.params;
    const before = await prisma.warehouse.findUnique({ where: { id } });
    if (!before) return errorResponse("Lager wurde nicht gefunden.", 404);
    if (isProductionRuntime && before.isDemoData) return errorResponse("Dieses Lager ist in der Produktion nicht verfügbar.", 404);

    const references = await warehouseDeleteReferences(id);
    if (references.total > 0) {
      return errorResponse(
        "Dieses Lager ist noch mit Aufträgen oder Lagerhistorie verknüpft. Deaktiviere es stattdessen, damit die Historie erhalten bleibt.",
        409,
      );
    }

    const deleted = await prisma.$transaction(async (tx) => {
      const replacement = before.isDefault
        ? await tx.warehouse.findFirst({
            where: { ...warehouseSourceWhere(), id: { not: id }, isActive: true },
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            select: { id: true },
          })
        : null;
      const removed = await tx.warehouse.delete({ where: { id } });
      if (replacement) await tx.warehouse.update({ where: { id: replacement.id }, data: { isDefault: true } });
      return removed;
    });
    await createAuditLog({ userId: session.id, action: "settings.warehouse_deleted", entityType: "Warehouse", entityId: id, oldValues: before });
    await notifyAdmins({ type: "WAREHOUSE_CHANGED", title: "Lager gelöscht", message: `${before.name} wurde gelöscht.` });
    return successResponse(deleted);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return errorResponse(
        "Dieses Lager wurde inzwischen verknüpft und kann nicht gelöscht werden. Deaktiviere es stattdessen.",
        409,
      );
    }
    return routeErrorResponse(error);
  }
}
