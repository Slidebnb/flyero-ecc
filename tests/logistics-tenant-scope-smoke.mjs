import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const logistics = await readFile("src/lib/logistics.ts", "utf8");
const dashboardRoute = await readFile("src/app/api/admin/logistics/route.ts", "utf8");
const shipmentsRoute = await readFile("src/app/api/admin/logistics/shipments/route.ts", "utf8");
const transfersRoute = await readFile("src/app/api/admin/logistics/transfers/route.ts", "utf8");
const stockCountsRoute = await readFile("src/app/api/admin/logistics/stock-counts/route.ts", "utf8");
const page = await readFile("src/app/admin/logistics/page.tsx", "utf8");
const shipmentPage = await readFile("src/app/admin/logistics/shipments/page.tsx", "utf8");
const warehouseDetailPage = await readFile("src/app/admin/logistics/warehouses/[id]/page.tsx", "utf8");
const warehouseDetailRoute = await readFile("src/app/api/admin/logistics/warehouses/[id]/route.ts", "utf8");

assert.match(logistics, /shipmentScopeForUser/);
assert.match(logistics, /order: \{ tenantId: actor\.tenantId \?\? "__no_tenant__" \}/);
assert.match(logistics, /inventory: \{ order: \{ tenantId: actor\.tenantId \?\? "__no_tenant__" \} \}/);
assert.match(logistics, /export async function getLogisticsAnalytics\([^)]*tenantId/);
assert.match(logistics, /export async function createLogisticsShipment\([^)]*tenantId/);
assert.match(logistics, /export async function createWarehouseTransfer\([^)]*tenantId/);
assert.match(logistics, /export async function createWarehouseStockCount\([^)]*tenantId/);
for (const route of [dashboardRoute, shipmentsRoute, transfersRoute, stockCountsRoute, page, shipmentPage, warehouseDetailPage]) {
  assert.match(route, /session\.role === UserRole\.ADMIN \? undefined : session\.tenantId/);
}
assert.match(shipmentPage, /order: \{ tenantId: tenantId \?\? "__no_tenant__" \}/);
assert.match(shipmentPage, /where: tenantId === undefined \? \{\} : \{ tenantId: tenantId \?\? "__no_tenant__" \}/);
assert.match(warehouseDetailPage, /const orderTenantWhere = tenantId === undefined \? \{\} : \{ tenantId: tenantId \?\? "__no_tenant__" \}/);
assert.match(warehouseDetailPage, /inventories: \{ where: \{ order: orderTenantWhere \}/);
assert.match(warehouseDetailPage, /stockCounts: \{ where: \{ inventory: \{ order: orderTenantWhere \} \}/);
assert.match(warehouseDetailRoute, /inventories: \{[\s\S]*where: \{ order: orderTenantWhere \}/);
assert.match(warehouseDetailRoute, /shipments: \{[\s\S]*where: \{ order: orderTenantWhere \}/);
assert(!warehouseDetailRoute.includes("customer: true"), "Lagerdetail-API gibt weiterhin vollstÃ¤ndige Kundenobjekte aus.");
assert(!warehouseDetailRoute.includes("countedBy: true"), "Lagerdetail-API gibt weiterhin interne Benutzerobjekte aus.");

console.log("Logistics tenant scope smoke checks passed.");
