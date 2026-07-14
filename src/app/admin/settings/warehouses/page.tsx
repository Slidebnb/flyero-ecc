import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { warehouseSourceWhere } from "@/lib/warehouse";
import { WarehouseDeleteButton } from "./WarehouseDeleteButton";

async function createWarehouse(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN]);
  const isDefault = formData.get("isDefault") === "on";
  const warehouse = await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.warehouse.updateMany({ data: { isDefault: false } });
    return tx.warehouse.create({
      data: {
        name: String(formData.get("name") ?? ""),
        code: String(formData.get("code") ?? "").trim().toUpperCase(),
        city: String(formData.get("city") ?? ""),
        postalCode: String(formData.get("postalCode") ?? ""),
        region: String(formData.get("region") ?? ""),
        country: "DE",
        capacityLimit: Number(formData.get("capacityLimit") || 0) || null,
        address: {
          street: String(formData.get("street") ?? ""),
          houseNumber: String(formData.get("houseNumber") ?? ""),
          postalCode: String(formData.get("postalCode") ?? ""),
          city: String(formData.get("city") ?? ""),
          country: "DE",
        },
        isDefault,
        isActive: true,
        isDemoData: false,
        openingHours: String(formData.get("openingHours") ?? ""),
        contactPerson: String(formData.get("contactPerson") ?? ""),
        contactPhone: String(formData.get("contactPhone") ?? ""),
        contactEmail: String(formData.get("contactEmail") ?? ""),
      },
    });
  });
  await createAuditLog({ userId: session.id, action: "settings.warehouse_created", entityType: "Warehouse", entityId: warehouse.id, newValues: warehouse });
  await notifyAdmins({ type: "WAREHOUSE_CHANGED", title: "Lager geändert", message: `${warehouse.name} wurde angelegt.` });
  revalidatePath("/admin/settings/warehouses");
}

async function toggleWarehouse(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN]);
  const id = String(formData.get("id"));
  const before = await prisma.warehouse.findFirst({ where: { id, ...warehouseSourceWhere() } });
  if (!before) throw new Error("Lager wurde nicht gefunden.");
  const isDefault = formData.get("isDefault") === "on";
  const warehouse = await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.warehouse.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
    return tx.warehouse.update({
      where: { id },
      data: {
        name: String(formData.get("name") ?? ""),
        code: String(formData.get("code") ?? "").trim().toUpperCase(),
        city: String(formData.get("city") ?? ""),
        postalCode: String(formData.get("postalCode") ?? ""),
        region: String(formData.get("region") ?? ""),
        country: "DE",
        capacityLimit: Number(formData.get("capacityLimit") || 0) || null,
        address: {
          street: String(formData.get("street") ?? ""),
          houseNumber: String(formData.get("houseNumber") ?? ""),
          postalCode: String(formData.get("postalCode") ?? ""),
          city: String(formData.get("city") ?? ""),
          country: "DE",
        },
        openingHours: String(formData.get("openingHours") ?? ""),
        contactPerson: String(formData.get("contactPerson") ?? ""),
        contactPhone: String(formData.get("contactPhone") ?? ""),
        contactEmail: String(formData.get("contactEmail") ?? ""),
        isActive: formData.get("isActive") === "on",
        isDefault,
      },
    });
  });
  await createAuditLog({ userId: session.id, action: "settings.warehouse_updated", entityType: "Warehouse", entityId: warehouse.id, oldValues: before, newValues: warehouse });
  await notifyAdmins({ type: "WAREHOUSE_CHANGED", title: "Lager geändert", message: `${warehouse.name} wurde aktualisiert.` });
  revalidatePath("/admin/settings/warehouses");
}

export default async function WarehouseSettingsPage() {
  await requireRole([UserRole.ADMIN]);
  const warehouses = await prisma.warehouse.findMany({ where: warehouseSourceWhere(), orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  return (
    <AdminPortalShell eyebrow="Einstellungen" title="Lager">
      <section className="panel stack widePanel">
        <h2 className="sectionTitle">Lager anlegen</h2>
        <form action={createWarehouse} className="formGrid">
          <label>Name<input name="name" required /></label><label>Code<input name="code" placeholder="KOB-HQ" required /></label><label>Stadt<input name="city" required /></label><label>PLZ<input name="postalCode" required /></label>
          <label>Region<input name="region" /></label><label>Kapazität Flyer<input name="capacityLimit" type="number" min="0" /></label>
          <label>Straße<input name="street" /></label><label>Hausnummer<input name="houseNumber" /></label><label>Öffnungszeiten<textarea name="openingHours" /></label>
          <label>Ansprechpartner<input name="contactPerson" /></label><label>Telefon<input name="contactPhone" /></label><label>E-Mail<input name="contactEmail" /></label>
          <label><input name="isDefault" type="checkbox" /> Standardlager</label><button type="submit">Anlegen</button>
        </form>
      </section>
      <section className="panel stack widePanel">
        <h2 className="sectionTitle">Bestehende Lager</h2>
        {!warehouses.length ? <p className="emptyState">Noch kein echtes Lager angelegt.</p> : null}
        {warehouses.map((warehouse) => {
          const address = warehouse.address as { street?: string; houseNumber?: string } | null;
          return (
            <form action={toggleWarehouse} className="card stack" key={warehouse.id}>
              <input type="hidden" name="id" value={warehouse.id} />
              <div className="formGrid">
                <label>Name<input name="name" defaultValue={warehouse.name} /></label>
                <label>Code<input name="code" defaultValue={warehouse.code} /></label>
                <label>Stadt<input name="city" defaultValue={warehouse.city} /></label>
                <label>PLZ<input name="postalCode" defaultValue={warehouse.postalCode} /></label>
                <label>Region<input name="region" defaultValue={warehouse.region ?? ""} /></label>
                <label>Kapazität Flyer<input name="capacityLimit" type="number" min="0" defaultValue={warehouse.capacityLimit ?? ""} /></label>
                <label>Straße<input name="street" defaultValue={address?.street ?? ""} /></label>
                <label>Hausnummer<input name="houseNumber" defaultValue={address?.houseNumber ?? ""} /></label>
                <label>Öffnungszeiten<textarea name="openingHours" defaultValue={warehouse.openingHours ?? ""} /></label>
                <label>Ansprechpartner<input name="contactPerson" defaultValue={warehouse.contactPerson ?? ""} /></label>
                <label>Telefon<input name="contactPhone" defaultValue={warehouse.contactPhone ?? ""} /></label>
                <label>E-Mail<input name="contactEmail" defaultValue={warehouse.contactEmail ?? ""} /></label>
              </div>
              <label><input name="isActive" type="checkbox" defaultChecked={warehouse.isActive} /> aktiv</label>
              <label><input name="isDefault" type="checkbox" defaultChecked={warehouse.isDefault} /> Standardlager</label>
              <button type="submit">Lager speichern</button>
              <WarehouseDeleteButton id={warehouse.id} name={warehouse.name} />
            </form>
          );
        })}
      </section>
    </AdminPortalShell>
  );
}
