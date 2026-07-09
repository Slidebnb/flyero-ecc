import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let baseUrl = process.env.MODULE23_BASE_URL || `http://localhost:${process.env.MODULE23_PORT || "3023"}`;
const PASSWORD = "DemoPasswort123!";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timer);
  }
}

async function ensureServer() {
  const candidates = [
    baseUrl,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
  ];
  for (const candidate of candidates) {
    try {
      baseUrl = candidate;
      const response = await fetchWithTimeout(`${baseUrl}/api/health`);
      if (response.status < 500) return null;
    } catch {}
  }

  baseUrl = process.env.MODULE23_BASE_URL || `http://localhost:${process.env.MODULE23_PORT || "3023"}`;
  const env = { ...process.env, PORT: new URL(baseUrl).port || "3023" };
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  for (let attempt = 0; attempt < 45; attempt += 1) {
    await sleep(1000);
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/health`);
      if (response.status < 500) return child;
    } catch {}
  }
  child.kill();
  throw new Error("Dev-Server konnte fuer Modul 23 nicht gestartet werden.");
}

function cookieHeaderFrom(response) {
  return (response.headers.get("set-cookie") || "")
    .split(/,(?=[^;,]+=)/)
    .map((item) => item.split(";")[0])
    .join("; ");
}

async function login(email) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert(response.status === 200, `Login fehlgeschlagen fuer ${email}: ${response.status} ${await response.text()}`);
  return cookieHeaderFrom(response);
}

async function json(path, { method = "GET", cookie = "", body, expected = [200] } = {}) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  assert(expected.includes(response.status), `${method} ${path} erwartete ${expected.join("/")} bekam ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const server = await ensureServer();
  try {
    const adminCookie = await login("admin@example.com");
    const warehouseCookie = await login("warehouse@example.com");

    const warehouses = await prisma.warehouse.findMany({ include: { regions: true } });
    assert(warehouses.length >= 5, "Modul 23 Seed: mindestens 5 Lager fehlen.");
    assert(warehouses.some((warehouse) => warehouse.regions.length > 0), "WarehouseRegion Seed fehlt.");
    assert(warehouses.some((warehouse) => !warehouse.isActive) === false || warehouses.length >= 5, "Warehouse Aktivitaet nicht plausibel.");

    const koblenz = await prisma.warehouse.findFirst({ where: { code: "KOB-M23" }, include: { regions: true } });
    const frankfurt = await prisma.warehouse.findFirst({ where: { code: "FRA-M23" }, include: { regions: true } });
    const inactive = await prisma.warehouse.findFirst({ where: { code: "OFF-M23" } });
    assert(koblenz?.regions.some((region) => region.postalCodes.some((code) => code.startsWith("560"))), "Koblenz Region fehlt.");
    assert(frankfurt?.regions.some((region) => region.city === "Frankfurt am Main"), "Frankfurt Region fehlt.");
    assert(inactive && inactive.isActive === false, "Inaktives Test-Lager fehlt.");

    let shipments = await prisma.logisticsShipment.findMany();
    const transfers = await prisma.warehouseTransfer.findMany();
    const counts = await prisma.warehouseStockCount.findMany();
    const reusableDelayedShipment = shipments.find((shipment) => shipment.notes?.includes("seed.module23"));
    if (reusableDelayedShipment) {
      await prisma.logisticsShipment.update({
        where: { id: reusableDelayedShipment.id },
        data: {
          status: "IN_TRANSIT",
          expectedDeliveryDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          deliveredAt: null,
          receivedById: null,
        },
      });
      shipments = await prisma.logisticsShipment.findMany();
    }
    assert(shipments.length >= 5, "Seed Sendungen fehlen.");
    assert(transfers.length >= 4, "Seed Umlagerungen fehlen.");
    assert(counts.length >= 4, "Seed Inventuren fehlen.");
    assert(shipments.some((shipment) => shipment.status === "DAMAGED"), "Beschaedigte Lieferung fehlt.");
    assert(shipments.some((shipment) => shipment.expectedDeliveryDate && shipment.expectedDeliveryDate < new Date() && ["CREATED", "IN_TRANSIT"].includes(shipment.status)), "Verspaetete Lieferung fehlt.");

    const adminLogistics = await json("/api/admin/logistics", { cookie: adminCookie });
    assert(adminLogistics.data.analytics.openShipments >= 1, "Admin Analytics offene Sendungen fehlt.");
    assert(adminLogistics.data.analytics.shipmentsByStatus.length >= 1, "Analytics Sendungen nach Status fehlen.");

    const adminWarehouses = await json("/api/admin/logistics/warehouses", { cookie: adminCookie });
    const warehouseScoped = await json("/api/warehouse/shipments", { cookie: warehouseCookie });
    assert(adminWarehouses.data.length >= warehouses.length, "Admin sieht nicht alle Lager.");

    const warehouseUser = await prisma.user.findUnique({ where: { email: "warehouse@example.com" } });
    assert(warehouseUser?.warehouseId, "Warehouse Demo-User hat kein Lager.");
    assert(
      warehouseScoped.data.every((shipment) => shipment.warehouseId === warehouseUser.warehouseId),
      "Warehouse-User sieht Sendungen fremder Lager.",
    );

    const order = await prisma.order.findFirst({ where: { assignedWarehouseId: { not: null } } });
    assert(order?.warehouseAssignmentReason, "Lagerzuweisung am Auftrag fehlt.");
    const assignedToInactive = await prisma.order.count({ where: { assignedWarehouseId: inactive.id } });
    assert(assignedToInactive === 0, "Inaktives Lager wurde Auftraegen zugewiesen.");

    const delayedOpenShipmentIds = new Set(
      shipments
        .filter((shipment) => shipment.expectedDeliveryDate && shipment.expectedDeliveryDate < new Date() && ["CREATED", "IN_TRANSIT"].includes(shipment.status))
        .map((shipment) => shipment.id),
    );
    const shipmentForUpdate =
      shipments.find((shipment) => shipment.status === "DELIVERED") ??
      shipments.find((shipment) => shipment.status !== "RECEIVED" && !delayedOpenShipmentIds.has(shipment.id)) ??
      shipments[0];
    await json(`/api/admin/logistics/shipments/${shipmentForUpdate.id}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { status: "DAMAGED", notes: "Modul 23 Smoke: beschaedigt" },
    });
    const damaged = await prisma.logisticsShipment.findUnique({ where: { id: shipmentForUpdate.id } });
    assert(damaged?.status === "DAMAGED", "Sendung konnte nicht als beschaedigt markiert werden.");

    const inventory = await prisma.warehouseInventory.findFirst({ where: { warehouseId: warehouseUser.warehouseId } });
    assert(inventory, "Warehouse-User hat keinen Bestand fuer Inventurtest.");
    const countResponse = await json("/api/warehouse/stock-counts", {
      method: "POST",
      cookie: warehouseCookie,
      expected: [201],
      body: {
        warehouseId: warehouseUser.warehouseId,
        inventoryId: inventory.id,
        expectedQuantity: inventory.remainingFlyers ?? inventory.expectedFlyers,
        countedQuantity: inventory.remainingFlyers ?? inventory.expectedFlyers,
        notes: "Modul 23 Smoke Inventur",
      },
    });
    assert(countResponse.data.difference === 0, "Inventur-Differenz wurde falsch berechnet.");

    const transferForUpdate = transfers.find((transfer) => transfer.status !== "RECEIVED") ?? transfers[0];
    await json(`/api/admin/logistics/transfers/${transferForUpdate.id}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { status: "RECEIVED", notes: "Modul 23 Smoke: erhalten" },
    });
    const receivedTransfer = await prisma.warehouseTransfer.findUnique({ where: { id: transferForUpdate.id } });
    assert(receivedTransfer?.status === "RECEIVED", "Umlagerung konnte nicht empfangen werden.");

    const auditActions = await prisma.auditLog.findMany({ where: { action: { startsWith: "logistics." } } });
    const notifications = await prisma.notification.findMany({ where: { type: { startsWith: "LOGISTICS_" } } });
    assert(auditActions.length >= 6, "Logistik AuditLogs fehlen.");
    assert(notifications.length >= 3, "Logistik Notifications fehlen.");

    console.log("Modul 23 Smoke-Test erfolgreich abgeschlossen.");
  } finally {
    await prisma.$disconnect();
    if (server) server.kill();
  }
}

main().catch(async (error) => {
  await prisma.$disconnect().catch(() => undefined);
  console.error(error);
  process.exit(1);
});
