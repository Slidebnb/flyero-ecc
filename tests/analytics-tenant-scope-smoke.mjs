import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const analytics = await readFile("src/lib/analytics.ts", "utf8");
const support = await readFile("src/lib/support.ts", "utf8");
const documents = await readFile("src/lib/documents.ts", "utf8");
const overviewRoute = await readFile("src/app/api/admin/analytics/route.ts", "utf8");
const exportRoute = await readFile("src/app/api/admin/analytics/export/route.ts", "utf8");
const heatmap = await readFile("src/lib/smartMaps.ts", "utf8");
const heatmapRoute = await readFile("src/app/api/admin/maps/heatmap/route.ts", "utf8");

assert.match(analytics, /export type AnalyticsScope/);
for (const functionName of [
  "getBusinessOverview",
  "getAnalyticsFilterOptions",
  "getAnalyticsExportRows",
  "getOrderMetrics",
  "getRevenueMetrics",
  "getDistributorMetrics",
]) {
  assert.match(analytics, new RegExp(`export async function ${functionName}\\([^)]*scope`), `${functionName} muss einen Tenant-Scope akzeptieren.`);
}
assert.match(support, /export async function getSupportAnalytics\([^)]*scope/);
assert.match(documents, /export async function getDocumentAnalytics\([^)]*scope/);
assert.match(overviewRoute, /getBusinessOverview\(filters, \{ tenantId: session\.tenantId \}\)/);
assert.match(exportRoute, /getAnalyticsExportRows\(filters, \{ tenantId: session\.tenantId \}\)/);
assert.match(analytics, /wonCustomer: \{ tenantId: scope\.tenantId \}/);
assert.match(analytics, /tenantId: scope\.tenantId/);
assert.match(support, /tenantId: scope\.tenantId/);
assert.match(documents, /tenantId: scope\.tenantId/);
assert.match(heatmap, /export async function getHeatmapData\(tenantId\?: string \| null\)/);
assert.match(heatmap, /tenantId \? \{ OR: \[\{ tenantId: null \}, \{ tenantId \}\] \} : \{\}/);
assert.match(heatmapRoute, /requirePermission\(Permission\.ANALYTICS_VIEW\)/);
assert.match(heatmapRoute, /getHeatmapData\(session\.role === UserRole\.ADMIN \? undefined : session\.tenantId\)/);

console.log("Analytics tenant scope smoke checks passed.");
