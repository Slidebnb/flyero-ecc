import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fileIncludes(path, snippets) {
  assert(existsSync(path), `${path} fehlt.`);
  const content = await readFile(path, "utf8");
  for (const snippet of snippets) {
    assert(content.includes(snippet), `${path} enthaelt nicht: ${snippet}`);
  }
}

await fileIncludes("prisma/schema.prisma", [
  "WAREHOUSE_STAFF",
  "model Warehouse",
  "model WarehouseLocation",
  "model WarehouseInventory",
  "model WarehouseHistory",
  "pickupToken",
  "pickupStatus",
  "reservedDistributorId",
  "preparedAt",
]);

await fileIncludes("src/lib/constants.ts", [
  "WAREHOUSE_INVENTORY_STATUS_LABELS",
  "READY_FOR_PICKUP",
  "FLYERS_EXPECTED",
]);

await fileIncludes("src/lib/warehouse.ts", [
  "createQrPngDataUrl",
  "ensureInventoryForApprovedOrder",
  "syncOrderStatusForInventory",
]);

for (const path of [
  "src/app/warehouse/dashboard/page.tsx",
  "src/app/warehouse/checkin/page.tsx",
  "src/app/warehouse/locations/page.tsx",
  "src/app/warehouse/inventory/page.tsx",
  "src/app/warehouse/inventory/[id]/page.tsx",
  "src/app/admin/warehouse/page.tsx",
  "src/app/api/warehouse/checkin/route.ts",
  "src/app/api/warehouse/status/route.ts",
  "src/app/api/warehouse/qrcode/route.ts",
  "src/app/api/warehouse/locations/route.ts",
]) {
  assert(existsSync(path), `${path} fehlt.`);
}

const [warehouseStaff, warehouses, locations, inventories, qrInventories, histories] =
  await Promise.all([
    prisma.user.count({ where: { role: "WAREHOUSE_STAFF", status: "ACTIVE" } }),
    prisma.warehouse.count(),
    prisma.warehouseLocation.count(),
    prisma.warehouseInventory.count(),
    prisma.warehouseInventory.count({
      where: {
        qrCodePngDataUrl: { startsWith: "data:image/png;base64," },
        pickupToken: { not: "" },
      },
    }),
    prisma.warehouseHistory.count(),
  ]);

assert(warehouseStaff >= 1, "Es fehlt ein aktiver Lager-User.");
assert(warehouses >= 1, "Es fehlt ein Lager.");
assert(locations >= 40, "Es fehlen die 40 Demo-Lagerplaetze.");
assert(inventories >= 10, "Es fehlen mindestens 10 Lagerbestaende.");
assert(qrInventories >= 10, "Es fehlen QR-Code-PNGs fuer Lagerbestaende.");
assert(histories >= 10, "Es fehlen Lagerhistorien.");

const readyInventory = await prisma.warehouseInventory.findFirst({
  where: { status: "READY_FOR_PICKUP", pickupStatus: "PREPARED" },
});
assert(readyInventory, "Es fehlt ein vorbereiteter abholbereiter Bestand.");

await prisma.$disconnect();
console.log("Module 4 smoke checks passed.");
