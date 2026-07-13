import assert from "node:assert/strict";
import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const port = process.env.AREA_SCOPE_PORT || "3038";
const sharedBaseUrl = process.env.AREA_SCOPE_BASE_URL || "";
const baseUrl = sharedBaseUrl || `http://localhost:${port}`;
const password = "DemoPasswort123!";
const ip = `198.51.100.${Date.now() % 200 + 20}`;
let server = null;

function cookieHeaderFrom(response) {
  return (response.headers.get("set-cookie") || "")
    .split(/,(?=[^;,]+=)/)
    .map((item) => item.split(";")[0])
    .join("; ");
}

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email: "support@example.com", password }),
  });
  assert.equal(response.status, 200, `Support-Login fehlgeschlagen: ${response.status}`);
  return cookieHeaderFrom(response);
}

async function startServer() {
  server = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, EMAIL_PROVIDER: "mock", PORT: port },
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.status < 500) return;
    } catch {
      // Server bootet noch.
    }
  }
  throw new Error(`Area-Scope-Testserver auf ${baseUrl} konnte nicht gestartet werden.`);
}

let supportCookie = "";
try {
  const support = await prisma.user.findUnique({
    where: { email: "support@example.com" },
    select: { id: true, tenantId: true, role: true },
  });
  assert.equal(support?.role, "SUPPORT_DISPATCHER", "Support-Demoaccount fehlt.");
  assert.ok(support.tenantId, "Support-Demoaccount braucht einen Tenant.");

  const foreignArea = await prisma.distributionArea.findFirst({
    where: { tenantId: { not: support.tenantId }, customerId: { not: null }, status: { not: "DELETED" } },
    select: { id: true, tenantId: true },
  });
  assert.ok(foreignArea, "Smoke braucht ein kundengebundenes Gebiet eines fremden Tenants.");

  if (!sharedBaseUrl) await startServer();
  supportCookie = await login();
  const listResponse = await fetch(`${baseUrl}/api/areas`, { headers: { cookie: supportCookie } });
  assert.equal(listResponse.status, 200, `Support-Gebietsliste fehlgeschlagen: ${listResponse.status}`);
  const listBody = await listResponse.json();
  assert.ok(Array.isArray(listBody.data), "Gebietsliste fehlt.");
  assert.ok(
    listBody.data.every((area) => area.tenantId === null || area.tenantId === support.tenantId),
    "Support darf keine kundengebundenen Gebiete anderer Tenants sehen.",
  );

  const deleteResponse = await fetch(`${baseUrl}/api/areas/${foreignArea.id}`, {
    method: "DELETE",
    headers: { cookie: supportCookie },
  });
  assert.equal(deleteResponse.status, 404, "Support darf fremde Gebiete nicht deaktivieren.");
  console.log("Area tenant scope smoke passed.");
} finally {
  if (server) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    else server.kill();
  }
  await prisma.$disconnect();
}
