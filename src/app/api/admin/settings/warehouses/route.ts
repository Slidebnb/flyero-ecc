import { NextRequest } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { warehouseSourceWhere } from "@/lib/warehouse";

function warehouseData(body: Record<string, unknown>) {
  const city = String(body.city ?? "").trim();
  const postalCode = String(body.postalCode ?? "").trim();
  const fallbackCode = `${city.slice(0, 3)}-${postalCode}`.replace(/^-|-$/g, "") || "WH";
  const code = String(body.code ?? fallbackCode).trim().toUpperCase();
  return {
    name: String(body.name ?? "").trim(),
    code,
    city,
    postalCode,
    country: String(body.country ?? "DE").trim(),
    region: String(body.region ?? "").trim(),
    capacityLimit: Number(body.capacityLimit || 0) || null,
    address: {
      street: String(body.street ?? "").trim(),
      houseNumber: String(body.houseNumber ?? "").trim(),
      postalCode,
      city,
      country: String(body.country ?? "DE").trim(),
    },
    isActive: body.isActive !== false,
    isDefault: Boolean(body.isDefault),
    openingHours: String(body.openingHours ?? "").trim(),
    contactPerson: String(body.contactPerson ?? "").trim(),
    contactPhone: String(body.contactPhone ?? "").trim(),
    contactEmail: String(body.contactEmail ?? "").trim(),
  };
}

export async function GET() {
  try {
    await requirePermission(Permission.PLATFORM_SETTINGS_MANAGE);
    const warehouses = await prisma.warehouse.findMany({ where: warehouseSourceWhere(), orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
    return successResponse(warehouses);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.PLATFORM_SETTINGS_MANAGE);
    const body = await readBody(request) as Record<string, unknown>;
    const data = warehouseData(body);
    if (!data.name || !data.city || !data.postalCode) throw new Error("Name, Stadt und PLZ sind Pflichtfelder.");
    const warehouse = await prisma.$transaction(async (tx) => {
      if (data.isDefault) await tx.warehouse.updateMany({ data: { isDefault: false } });
      return tx.warehouse.create({ data: { ...data, isDemoData: false } });
    });
    await createAuditLog({ userId: session.id, action: "settings.warehouse_created", entityType: "Warehouse", entityId: warehouse.id, newValues: warehouse });
    await notifyAdmins({ type: "WAREHOUSE_CHANGED", title: "Lager geaendert", message: `${warehouse.name} wurde angelegt.` });
    return successResponse(warehouse, 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
