import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const warehouseRoute = read("src/app/api/customer/warehouses/route.ts");
const orderRoute = read("src/app/api/customer/orders/route.ts");
const validators = read("src/lib/validators.ts");
const wizard = read("src/app/customer/orders/new/SmartOrderWizard.tsx");

assert.match(warehouseRoute, /requireTenantSession/);
assert.match(warehouseRoute, /warehouseSourceWhere/);
assert.match(warehouseRoute, /isActive:\s*true/);
assert.match(warehouseRoute, /select:/);

assert.match(validators, /warehouseId:\s*z\.string\(\)\.trim\(\)\.min\(1\)\.optional\(\)/);
assert.match(orderRoute, /warehouseId/);
assert.match(orderRoute, /isActive:\s*true/);
assert.match(orderRoute, /assignedWarehouseId/);

assert.match(wizard, /api\/customer\/warehouses/);
assert.match(wizard, /selectedWarehouseId/);
assert.match(wizard, /warehouseId: selectedWarehouseId/);
assert.match(wizard, /data-testid=\"customer-own-flyer-step\"/);
assert.doesNotMatch(wizard, /setFlyerSource\("PRINT_SERVICE"\)/);
assert.match(wizard, /Flyer sind bereits gedruckt/);
assert.match(wizard, /Empfangslager/);

console.log("Customer own-flyer warehouse selection smoke passed.");
