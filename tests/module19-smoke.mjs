import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE_URL = process.env.BETA_BASE_URL || "http://localhost:3000";
const PASSWORD = "DemoPasswort123!";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function includes(filePath, snippets) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
  const content = await readFile(filePath, "utf8");
  for (const snippet of snippets) {
    assert(content.includes(snippet), `${filePath} enthaelt nicht: ${snippet}`);
  }
}

async function fetchLocal(path, options = {}) {
  return fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
}

async function ensureServer() {
  try {
    const response = await fetchLocal("/");
    if (response.status < 500) return null;
  } catch {
    // Server wird unten gestartet.
  }

  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, EMAIL_PROVIDER: "mock" },
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  for (let attempt = 0; attempt < 45; attempt += 1) {
    await sleep(1000);
    try {
      const response = await fetchLocal("/");
      if (response.status < 500) return child;
    } catch {
      // Server bootet noch.
    }
  }
  child.kill();
  throw new Error("Dev-Server konnte fuer Modul 19 Smoke nicht gestartet werden.");
}

function cookieHeaderFrom(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return "";
  return setCookie.split(/,(?=[^;,]+=)/).map((item) => item.split(";")[0]).join("; ");
}

async function login(email) {
  const response = await fetchLocal("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert(response.status === 200, `Login fehlgeschlagen fuer ${email}: ${response.status} ${await response.text()}`);
  return cookieHeaderFrom(response);
}

async function jsonRequest(path, { cookie = "", expected = [200] } = {}) {
  const response = await fetchLocal(path, { headers: cookie ? { cookie } : {} });
  if (!expected.includes(response.status)) {
    throw new Error(`GET ${path} erwartete ${expected.join("/")} bekam ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

await includes("src/lib/analytics.ts", [
  "getBusinessOverview",
  "getRevenueMetrics",
  "getOrderMetrics",
  "getCustomerMetrics",
  "getDistributorMetrics",
  "getWarehouseMetrics",
  "getPaymentMetrics",
  "getReportMetrics",
  "getLeadMetrics",
]);
await includes("src/app/admin/analytics/page.tsx", ["Umsatz gesamt", "Verteilerleistung", "CSV exportieren"]);
await includes("README.md", ["Analytics Dashboard", "CSV Export", "KPIs"]);
await includes("ARCHITECTURE_DECISIONS.md", ["zentrale Analytics Services", "externes BI", "operativen Tabellen"]);
await includes("package.json", ["test:module19"]);

for (const filePath of [
  "src/app/api/admin/analytics/route.ts",
  "src/app/api/admin/analytics/revenue/route.ts",
  "src/app/api/admin/analytics/orders/route.ts",
  "src/app/api/admin/analytics/distributors/route.ts",
  "src/app/api/admin/analytics/export/route.ts",
]) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
}

const leadMonths = await prisma.lead.findMany({
  where: { source: "seed.module19" },
  select: { createdAt: true },
});
const uniqueLeadMonths = new Set(leadMonths.map((lead) => `${lead.createdAt.getFullYear()}-${lead.createdAt.getMonth() + 1}`));
assert(uniqueLeadMonths.size >= 4, "Seed enthaelt keine Analytics-Daten ueber mehrere Monate.");

const server = await ensureServer();
try {
  const adminCookie = await login("admin@example.com");
  const customerCookie = await login("kunde.immobilien@example.com");
  const distributorCookie = await login("verteiler.approved1@example.com");

  const page = await fetchLocal("/admin/analytics", { headers: { cookie: adminCookie } });
  assert(page.status === 200, `/admin/analytics lieferte ${page.status}`);
  const pageText = await page.text();
  assert(pageText.includes("Analytics"), "Admin Analytics Seite enthaelt keinen Titel.");
  assert(pageText.includes("Umsatz gesamt"), "Admin Analytics Seite enthaelt keine KPI-Kacheln.");

  const overview = await jsonRequest("/api/admin/analytics", { cookie: adminCookie });
  assert(typeof overview.data.summary.totalRevenue === "number", "totalRevenue fehlt.");
  assert(overview.data.summary.activeCustomers >= 1, "aktive Kunden fehlen.");
  assert(Array.isArray(overview.data.revenue.revenueByMonth), "Umsatz-Chart fehlt.");
  assert(Array.isArray(overview.data.distributors.distributorPerformance), "Verteilerleistung fehlt.");
  assert("averageTourDurationHours" in overview.data.operational, "Operative KPIs fehlen.");

  const city = overview.data.filters.city || "Koblenz";
  const filtered = await jsonRequest(`/api/admin/analytics?city=${encodeURIComponent(city)}`, { cookie: adminCookie });
  assert(filtered.data.filters.city === city, "Stadtfilter wurde nicht uebernommen.");

  const revenue = await jsonRequest("/api/admin/analytics/revenue", { cookie: adminCookie });
  assert(Array.isArray(revenue.data.revenueByMonth), "Revenue API liefert keine Monatsdaten.");
  const orders = await jsonRequest("/api/admin/analytics/orders", { cookie: adminCookie });
  assert(Array.isArray(orders.data.ordersByStatus), "Orders API liefert keine Statusdaten.");
  const distributors = await jsonRequest("/api/admin/analytics/distributors", { cookie: adminCookie });
  assert(Array.isArray(distributors.data.distributorPerformance), "Distributor API liefert keine Performance.");

  const exportResponse = await fetchLocal("/api/admin/analytics/export", { headers: { cookie: adminCookie } });
  assert(exportResponse.status === 200, `Export lieferte ${exportResponse.status}`);
  assert((exportResponse.headers.get("content-type") || "").includes("text/csv"), "Export ist kein CSV.");
  const csv = await exportResponse.text();
  assert(csv.includes("orderNumber;createdAt;city;customer"), "CSV Header fehlt.");

  const customerPage = await fetchLocal("/admin/analytics", { headers: { cookie: customerCookie } });
  assert([302, 303, 307, 308].includes(customerPage.status), "Customer darf Admin Analytics nicht sehen.");
  const distributorApi = await fetchLocal("/api/admin/analytics", { headers: { cookie: distributorCookie } });
  assert([302, 303, 307, 308, 403].includes(distributorApi.status), "Distributor darf Analytics API nicht sehen.");

  const [viewedLogs, exportedLogs] = await Promise.all([
    prisma.auditLog.count({ where: { action: "analytics.viewed" } }),
    prisma.auditLog.count({ where: { action: "analytics.exported" } }),
  ]);
  assert(viewedLogs >= 1, "analytics.viewed AuditLog fehlt.");
  assert(exportedLogs >= 1, "analytics.exported AuditLog fehlt.");

  console.log("Module 19 analytics smoke checks passed.");
} finally {
  await prisma.$disconnect();
  if (server) server.kill();
}
