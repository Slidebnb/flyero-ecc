import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const logistics = await readFile("src/lib/logistics.ts", "utf8");
const dashboardRoute = await readFile("src/app/api/admin/logistics/route.ts", "utf8");
const shipmentsRoute = await readFile("src/app/api/admin/logistics/shipments/route.ts", "utf8");
const transfersRoute = await readFile("src/app/api/admin/logistics/transfers/route.ts", "utf8");
const stockCountsRoute = await readFile("src/app/api/admin/logistics/stock-counts/route.ts", "utf8");
const page = await readFile("src/app/admin/logistics/page.tsx", "utf8");

assert.match(logistics, /shipmentScopeForUser/);
assert.match(logistics, /order: \{ tenantId: actor\.tenantId \?\? "__no_tenant__" \}/);
assert.match(logistics, /inventory: \{ order: \{ tenantId: actor\.tenantId \?\? "__no_tenant__" \} \}/);
assert.match(logistics, /export async function getLogisticsAnalytics\([^)]*tenantId/);
assert.match(logistics, /export async function createLogisticsShipment\([^)]*tenantId/);
assert.match(logistics, /export async function createWarehouseTransfer\([^)]*tenantId/);
assert.match(logistics, /export async function createWarehouseStockCount\([^)]*tenantId/);
for (const route of [dashboardRoute, shipmentsRoute, transfersRoute, stockCountsRoute, page]) {
  assert.match(route, /session\.role === UserRole\.ADMIN \? undefined : session\.tenantId/);
}

console.log("Logistics tenant scope smoke checks passed.");
