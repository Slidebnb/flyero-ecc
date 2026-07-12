import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dispatch = await readFile("src/lib/dispatch.ts", "utf8");
const dashboardRoute = await readFile("src/app/api/admin/dispatch/route.ts", "utf8");
const assignRoute = await readFile("src/app/api/admin/orders/[id]/assign/route.ts", "utf8");
const recommendRoute = await readFile("src/app/api/admin/dispatch/recommend/[orderId]/route.ts", "utf8");
const dismissRoute = await readFile("src/app/api/admin/dispatch/recommendations/[id]/dismiss/route.ts", "utf8");
const autoAssignRoute = await readFile("src/app/api/admin/dispatch/auto-assign/[orderId]/route.ts", "utf8");
const routing = await readFile("src/lib/routing.ts", "utf8");

assert.match(dispatch, /tenantId\?: string \| null/);
assert.match(dispatch, /tenantId: tenantId \?\? "__no_tenant__"/);
assert.match(dispatch, /user: \{ tenantId: tenantId \?\? "__no_tenant__" \}/);
assert.match(dispatch, /ensureOrderAccess/);
assert.match(dispatch, /getDispatchDashboard\([^)]*tenantId/);
assert.match(routing, /tenantId\?: string \| null/);
assert.match(routing, /tenantId: input\.tenantId \?\? "__no_tenant__"/);
assert.match(dashboardRoute, /getDispatchDashboard\(\{[\s\S]*\}, session\.role === UserRole\.ADMIN \? undefined : session\.tenantId\)/);
for (const route of [assignRoute, recommendRoute, dismissRoute, autoAssignRoute]) {
  assert.match(route, /tenantId: session\.role === UserRole\.ADMIN \? undefined : session\.tenantId/);
}

console.log("Dispatch tenant scope smoke checks passed.");
