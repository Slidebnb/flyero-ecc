import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routeFiles = [
  ["src/app/api/warehouse/route.ts", "GET", "WAREHOUSE_OPERATIONS_VIEW"],
  ["src/app/api/warehouse/checkin/route.ts", "POST", "WAREHOUSE_OPERATIONS_MANAGE"],
  ["src/app/api/warehouse/inventory/route.ts", "GET", "WAREHOUSE_OPERATIONS_VIEW"],
  ["src/app/api/warehouse/inventory/[id]/route.ts", "GET", "WAREHOUSE_OPERATIONS_VIEW"],
  ["src/app/api/warehouse/location/route.ts", "PATCH", "WAREHOUSE_OPERATIONS_MANAGE"],
  ["src/app/api/warehouse/locations/route.ts", "GET", "WAREHOUSE_OPERATIONS_VIEW"],
  ["src/app/api/warehouse/locations/route.ts", "POST", "WAREHOUSE_OPERATIONS_MANAGE"],
  ["src/app/api/warehouse/qrcode/route.ts", "POST", "WAREHOUSE_OPERATIONS_MANAGE"],
  ["src/app/api/warehouse/status/route.ts", "PATCH", "WAREHOUSE_OPERATIONS_MANAGE"],
  ["src/app/api/warehouse/shipments/route.ts", "GET", "WAREHOUSE_OPERATIONS_VIEW"],
  ["src/app/api/warehouse/shipments/[id]/route.ts", "PATCH", "WAREHOUSE_OPERATIONS_MANAGE"],
  ["src/app/api/warehouse/stock-counts/route.ts", "GET", "WAREHOUSE_OPERATIONS_VIEW"],
  ["src/app/api/warehouse/stock-counts/route.ts", "POST", "WAREHOUSE_OPERATIONS_MANAGE"],
  ["src/app/api/warehouse/transfers/route.ts", "GET", "WAREHOUSE_OPERATIONS_VIEW"],
  ["src/app/api/warehouse/transfers/[id]/route.ts", "PATCH", "WAREHOUSE_OPERATIONS_MANAGE"],
];

const sources = new Map();
for (const [filePath] of routeFiles) {
  if (!sources.has(filePath)) sources.set(filePath, await readFile(filePath, "utf8"));
}

const permissions = await readFile("src/lib/permissions.ts", "utf8");
assert.match(permissions, /WAREHOUSE_OPERATIONS_VIEW:/, "Warehouse-Betriebsleserecht fehlt.");
assert.match(permissions, /WAREHOUSE_OPERATIONS_MANAGE:/, "Warehouse-Betriebsrecht fehlt.");

for (const [filePath, method, permission] of routeFiles) {
  const source = sources.get(filePath);
  const methodBlock = source.match(new RegExp(`export async function ${method}\\b[\\s\\S]*?(?=\\nexport async function|$)`))?.[0] || "";
  assert.match(methodBlock, new RegExp(`requirePermission\\(Permission\\.${permission}\\)`), `${filePath} ${method} fehlt ${permission}.`);
  assert.doesNotMatch(methodBlock, /requireRole\(/, `${filePath} ${method} verwendet weiterhin requireRole.`);
}

console.log("Warehouse-Permission-Migrations-Smoke erfolgreich abgeschlossen.");
