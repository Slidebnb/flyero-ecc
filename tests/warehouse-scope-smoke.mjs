import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const port = process.env.WAREHOUSE_SCOPE_PORT || "3038";
const sharedBaseUrl = process.env.WAREHOUSE_SCOPE_BASE_URL || "";
const baseUrl = sharedBaseUrl || `http://localhost:${port}`;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const password = "DemoPasswort123!";
let server = null;

function assertStatus(response, allowed, label) {
  assert(allowed.includes(response.status), `${label}: erwartete ${allowed.join("/")}, bekam ${response.status}`);
}

function assertWarehousePrivacy(value, label) {
  const serialized = JSON.stringify(value);
  assert(!serialized.includes('"customer"'), `${label} serialisiert weiterhin ein Kundenobjekt.`);
  assert(!serialized.includes('"companyName"'), `${label} serialisiert weiterhin einen Firmennamen.`);
  assert(!serialized.includes('"requestedBy"'), `${label} serialisiert weiterhin einen Antragsteller.`);
  assert(!serialized.includes('"approvedBy"'), `${label} serialisiert weiterhin einen Freigeber.`);
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function startServer() {
  server = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, EMAIL_PROVIDER: "mock", PORT: port },
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await wait(1000);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.status < 500) return;
    } catch {
      // Server bootet noch.
    }
  }
  throw new Error(`Warehouse-Testserver auf ${baseUrl} konnte nicht gestartet werden.`);
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...options,
    headers: { ...(options.headers || {}) },
  });
}

async function login() {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.61" },
    body: JSON.stringify({ email: "warehouse@example.com", password }),
  });
  assertStatus(response, [200], "Warehouse-Login");
  const setCookie = response.headers.get("set-cookie");
  assert(setCookie, "Warehouse-Login hat kein Session-Cookie geliefert.");
  return setCookie.split(/,(?=[^;,]+=)/).map((item) => item.split(";")[0]).join("; ");
}

async function jsonRequest(path, cookie, body) {
  return request(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      cookie,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

try {
  const staff = await prisma.user.findUnique({
    where: { email: "warehouse@example.com" },
    select: { id: true, warehouseId: true, role: true },
  });
  assert.equal(staff?.role, "WAREHOUSE_STAFF", "Seed-Warehousekonto fehlt.");
  assert(staff.warehouseId, "Seed-Warehousekonto hat kein Lager.");

  const foreignInventory = await prisma.warehouseInventory.findFirst({
    where: { warehouseId: { not: staff.warehouseId } },
    select: { id: true, orderId: true, warehouseId: true },
  });
  assert(foreignInventory?.warehouseId, "Es fehlt ein Bestand in einem fremden Lager fuer den Scope-Test.");

  const ownLocation = await prisma.warehouseLocation.findFirst({
    where: { warehouseId: staff.warehouseId },
    select: { id: true },
  });
  assert(ownLocation, "Es fehlt ein Lagerplatz fuer den Scope-Test.");

  if (!sharedBaseUrl) await startServer();
  const cookie = await login();

  const inventoryResponse = await request("/api/warehouse/inventory", { headers: { cookie } });
  assertStatus(inventoryResponse, [200], "Lagerbestandliste");
  const inventoryBody = await inventoryResponse.json();
  assertWarehousePrivacy(inventoryBody, "Lagerbestandliste");
  assert(!inventoryBody.data.some((item) => item.id === foreignInventory.id), "Lagerpersonal sieht fremden Lagerbestand.");

  for (const path of ["/api/warehouse/shipments", "/api/warehouse/transfers", "/api/warehouse/stock-counts"]) {
    const response = await request(path, { headers: { cookie } });
    assertStatus(response, [200], `Lager-Response ${path}`);
    assertWarehousePrivacy(await response.json(), path);
  }

  const qrResponse = await jsonRequest("/api/warehouse/qrcode", cookie, { inventoryId: foreignInventory.id });
  assertStatus(qrResponse, [404], "QR fuer fremden Bestand");

  const locationResponse = await jsonRequest("/api/warehouse/location", cookie, {
    inventoryId: foreignInventory.id,
    warehouseLocationId: ownLocation.id,
  });
  assertStatus(locationResponse, [404], "Lagerplatz fuer fremden Bestand");

  const statusResponse = await jsonRequest("/api/warehouse/status", cookie, {
    inventoryId: foreignInventory.id,
    status: "FLYERS_EXPECTED",
  });
  assertStatus(statusResponse, [404], "Status fuer fremden Bestand");

  const stockCountResponse = await jsonRequest("/api/warehouse/stock-counts", cookie, {
    warehouseId: staff.warehouseId,
    inventoryId: foreignInventory.id,
    expectedQuantity: 1,
    countedQuantity: 1,
  });
  assertStatus(stockCountResponse, [404], "Inventur fuer fremden Bestand");

  const checkinResponse = await jsonRequest("/api/warehouse/checkin", cookie, {
    orderId: foreignInventory.orderId,
    warehouseId: staff.warehouseId,
    warehouseLocationId: ownLocation.id,
    cartonCount: 1,
    receivedFlyers: 1,
    damagedFlyers: 0,
  });
  assertStatus(checkinResponse, [404], "Check-in fuer fremden Auftrag");

  const countsResponse = await request("/api/warehouse/stock-counts", { headers: { cookie } });
  assertStatus(countsResponse, [200], "Inventurliste");
  const countsBody = await countsResponse.json();
  assert(!countsBody.data.some((item) => item.inventoryId === foreignInventory.id), "Lagerpersonal sieht fremde Inventur.");

  console.log("Warehouse scope smoke checks passed.");
} finally {
  if (server) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    else server.kill();
  }
  await prisma.$disconnect();
}
