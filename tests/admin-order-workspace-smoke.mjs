import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const listPage = readFileSync("src/app/admin/orders/page.tsx", "utf8");
const listRoute = readFileSync("src/app/api/admin/orders/route.ts", "utf8");
const detailRoute = readFileSync("src/app/api/admin/orders/[id]/route.ts", "utf8");
const detailPage = readFileSync("src/app/admin/orders/[id]/page.tsx", "utf8");

assert.match(listPage, /nextOrderAction/);
assert.match(listPage, /payments:/);
assert.match(listPage, /documents:/);
assert.match(listPage, /reports:/);
assert.match(listRoute, /requirePermission\(Permission\.ORDER_VIEW\)/);
assert.match(listRoute, /payments:/);
assert.match(listRoute, /documents:/);
assert.match(listRoute, /reports:/);
assert.match(detailRoute, /productionOrderWhere/);
assert.match(detailRoute, /payments:/);
assert.match(detailRoute, /documents:/);
assert.match(detailRoute, /reports:/);
assert.match(detailPage, /Verteilnachweise/);
assert.match(detailPage, /Bericht vorbereiten/);
assert.match(detailPage, /Bericht freigeben/);

console.log("Admin order workspace smoke passed.");
