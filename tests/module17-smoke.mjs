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
      ...(options.body && !(options.body instanceof FormData) ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
}

async function ensureServer() {
  try {
    const response = await fetchLocal("/");
    if (response.status < 500) return null;
  } catch {
    // Dev-Server wird unten gestartet.
  }

  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: process.env,
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
  throw new Error("Dev-Server konnte fuer Modul 17 Smoke nicht gestartet werden.");
}

function cookieHeaderFrom(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return "";
  return setCookie.split(/,(?=[^;,]+=)/).map((item) => item.split(";")[0]).join("; ");
}

async function loginAdmin() {
  const response = await fetchLocal("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@example.com", password: PASSWORD }),
  });
  assert(response.status === 200, `Admin-Login fehlgeschlagen: ${response.status} ${await response.text()}`);
  return cookieHeaderFrom(response);
}

async function jsonRequest(path, { method = "GET", cookie = "", body, expected = [200] } = {}) {
  const response = await fetchLocal(path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path} erwartete ${expected.join("/")} bekam ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

await includes("prisma/schema.prisma", [
  "model SystemLog",
  "model ErrorLog",
  "model SystemHealthCheck",
  "model BackgroundJobLog",
  "enum HealthStatus",
]);
await includes("src/lib/monitoring.ts", [
  "createSystemLog",
  "createErrorLog",
  "resolveErrorLog",
  "ignoreErrorLog",
  "runHealthCheck",
  "getMonitoringDashboard",
  "logBackgroundJobFailure",
]);
await includes("package.json", ["test:module17"]);

for (const filePath of [
  "src/app/api/health/route.ts",
  "src/app/api/admin/monitoring/route.ts",
  "src/app/api/admin/monitoring/errors/route.ts",
  "src/app/api/admin/monitoring/health-check/route.ts",
  "src/app/admin/monitoring/page.tsx",
  "src/app/admin/monitoring/errors/page.tsx",
  "src/app/error.tsx",
  "src/app/not-found.tsx",
]) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
}

const [systemLogCount, errorLogCount, healthCount, jobCount] = await Promise.all([
  prisma.systemLog.count({ where: { source: { startsWith: "seed.module17" } } }),
  prisma.errorLog.count({ where: { source: { startsWith: "seed.module17" } } }),
  prisma.systemHealthCheck.count({ where: { metadata: { path: ["source"], equals: "seed.module17" } } }),
  prisma.backgroundJobLog.count({ where: { metadata: { path: ["source"], equals: "seed.module17" } } }),
]);
assert(systemLogCount >= 30, "Seed SystemLogs fehlen.");
assert(errorLogCount >= 20, "Seed ErrorLogs fehlen.");
assert(healthCount >= 10, "Seed HealthChecks fehlen.");
assert(jobCount >= 15, "Seed BackgroundJobLogs fehlen.");

const server = await ensureServer();
try {
  const publicHealth = await jsonRequest("/api/health");
  assert(["OK", "DEGRADED", "DOWN"].includes(publicHealth.status), "/api/health liefert keinen minimalen Status.");
  assert(Object.keys(publicHealth).length === 1, "/api/health leakt Details.");

  const adminCookie = await loginAdmin();
  const dashboardPage = await fetchLocal("/admin/monitoring", { headers: { cookie: adminCookie } });
  assert(dashboardPage.status === 200, `/admin/monitoring lieferte ${dashboardPage.status}`);
  const dashboardHtml = await dashboardPage.text();
  assert(dashboardHtml.includes("Systemstatus"), "Admin Monitoring Dashboard rendert nicht.");

  const dashboard = await jsonRequest("/api/admin/monitoring", { cookie: adminCookie });
  assert(dashboard.data.latestHealth, "Admin Monitoring API liefert keinen Health-Status.");

  const list = await jsonRequest("/api/admin/monitoring/errors", { cookie: adminCookie });
  assert(Array.isArray(list.data), "Admin Errorliste liefert keine Liste.");

  const healthRun = await jsonRequest("/api/admin/monitoring/health-check", {
    method: "POST",
    cookie: adminCookie,
    expected: [201],
  });
  assert(healthRun.data.id, "HealthCheck ausloesen lieferte keine ID.");

  const errorToResolve = await prisma.errorLog.create({
    data: {
      severity: "HIGH",
      source: "module17.smoke.resolve",
      message: "Smoke Resolve",
      metadata: { source: "module17-smoke" },
    },
  });
  const resolved = await jsonRequest(`/api/admin/monitoring/errors/${errorToResolve.id}/resolve`, {
    method: "POST",
    cookie: adminCookie,
    body: { resolutionNote: "Smoke geloest." },
  });
  assert(resolved.data.status === "RESOLVED", "ErrorLog wurde nicht geloest.");

  const errorToIgnore = await prisma.errorLog.create({
    data: {
      severity: "LOW",
      source: "module17.smoke.ignore",
      message: "Smoke Ignore",
      metadata: { source: "module17-smoke" },
    },
  });
  const ignored = await jsonRequest(`/api/admin/monitoring/errors/${errorToIgnore.id}/ignore`, {
    method: "POST",
    cookie: adminCookie,
    body: { resolutionNote: "Smoke ignoriert." },
  });
  assert(ignored.data.status === "IGNORED", "ErrorLog wurde nicht ignoriert.");

  const [auditCount, notificationCount, migrationExists] = await Promise.all([
    prisma.auditLog.count({ where: { action: { in: ["monitoring.health_checked", "monitoring.error_resolved", "monitoring.error_ignored"] } } }),
    prisma.notification.count({ where: { type: { in: ["MONITORING_CRITICAL_ERROR", "MONITORING_HEALTH_DEGRADED", "MONITORING_HEALTH_DOWN", "MONITORING_ERROR_RESOLVED"] } } }),
    Promise.resolve(existsSync("prisma/migrations/20260701090000_module17_monitoring/migration.sql")),
  ]);
  assert(auditCount >= 3, "Monitoring AuditLogs fehlen.");
  assert(notificationCount >= 1, "Monitoring Notifications fehlen.");
  assert(migrationExists, "Monitoring Migration fehlt.");

  console.log("Module 17 monitoring smoke checks passed.");
} finally {
  await prisma.$disconnect();
  if (server) server.kill();
}
