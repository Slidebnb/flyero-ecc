import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const PASSWORD = "DemoPasswort123!";
const TEST_PORT = process.env.DISTRIBUTOR_PRIVACY_PORT || process.env.PORT || "3041";
let baseUrl = process.env.DISTRIBUTOR_PRIVACY_BASE_URL || `http://localhost:${TEST_PORT}`;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function cookieHeaderFrom(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return "";
  return setCookie.split(/,(?=[^;,]+=)/).map((item) => item.split(";")[0]).join("; ");
}

async function fetchLocal(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  try {
    return await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
      ...options,
      signal: controller.signal,
      headers: { ...(options.headers || {}) },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureServer() {
  const candidates = [
    baseUrl,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
  ];
  for (const candidate of candidates) {
    try {
      baseUrl = candidate;
      const response = await fetchLocal("/", { timeoutMs: 2500 });
      if (response.status < 500) return null;
    } catch {
      // Kandidat ist nicht erreichbar.
    }
  }

  baseUrl = process.env.DISTRIBUTOR_PRIVACY_BASE_URL || `http://localhost:${TEST_PORT}`;

  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, EMAIL_PROVIDER: "mock", PORT: TEST_PORT },
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(1000);
    try {
      const response = await fetchLocal("/");
      if (response.status < 500) return child;
    } catch {
      // Server bootet noch.
    }
  }
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    child.kill();
  }
  throw new Error("Dev-Server konnte fuer den Verteiler-Privacy-Smoke nicht gestartet werden.");
}

async function login(email) {
  const response = await fetchLocal("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.231" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (response.status !== 200) {
    throw new Error(`Login fehlgeschlagen fuer ${email}: ${response.status} ${await response.text()}`);
  }
  return cookieHeaderFrom(response);
}

async function json(path, cookie, expected = 200) {
  const response = await fetchLocal(path, { headers: { cookie } });
  if (response.status !== expected) {
    throw new Error(`${path} erwartete ${expected}, bekam ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function assertNoSensitiveKeys(value, path = "data") {
  const blocked = new Set([
    "customer",
    "customerid",
    "companyname",
    "contactname",
    "contactphone",
    "billingaddress",
    "deliveryaddress",
    "vatid",
    "email",
    "phone",
  ]);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert(!blocked.has(key.toLowerCase()), `Verteiler-Response gibt ${path}.${key} aus.`);
    assertNoSensitiveKeys(child, `${path}.${key}`);
  }
}

const sourceFiles = [
  "src/app/api/distributor/available-orders/route.ts",
  "src/app/api/distributor/tours/route.ts",
  "src/app/api/distributor/tours/[id]/route.ts",
  "src/app/distributor/dashboard/page.tsx",
  "src/app/distributor/tours/[id]/page.tsx",
];
for (const file of sourceFiles) {
  const content = await readFile(file, "utf8");
  assert(!content.includes("customer: true"), `${file} laedt weiterhin customer: true.`);
  assert(!content.includes("order.customer"), `${file} verwendet weiterhin order.customer.`);
}

const tours = await prisma.distributionTour.findMany({
  where: { distributor: { reviewStatus: "APPROVED" } },
  include: { distributor: { include: { user: true } }, order: { include: { customer: true } } },
  orderBy: { createdAt: "asc" },
});
assert(tours.length >= 2, "Mindestens zwei freigegebene Verteiler-Touren fuer den Privacy-Test fehlen.");
const ownTour = tours[0];
const foreignTour = tours.find((tour) => tour.distributorId !== ownTour.distributorId);
assert(foreignTour, "Keine fremde Tour fuer den Negativtest gefunden.");

const server = await ensureServer();
try {
  const cookie = await login(ownTour.distributor.user.email);
  const toursPayload = await json("/api/distributor/tours", cookie);
  const availablePayload = await json("/api/distributor/available-orders", cookie);
  assertNoSensitiveKeys(toursPayload.data, "tours");
  assertNoSensitiveKeys(availablePayload.data, "availableOrders");
  assert(toursPayload.data.some((tour) => tour.id === ownTour.id), "Eigene Tour fehlt in der Verteilerliste.");

  const ownPayload = await json(`/api/distributor/tours/${ownTour.id}`, cookie);
  assertNoSensitiveKeys(ownPayload.data, "tour");
  assert(ownPayload.data.id === ownTour.id, "Eigene Tourdetailseite liefert falsche Tour.");

  const foreignResponse = await fetchLocal(`/api/distributor/tours/${foreignTour.id}`, { headers: { cookie } });
  assert(foreignResponse.status === 404, `Fremde Tour ist fuer Verteiler erreichbar: ${foreignResponse.status}`);

  const dashboard = await fetchLocal("/distributor/dashboard", { headers: { cookie } });
  assert(dashboard.status === 200, `Verteiler-Dashboard lieferte ${dashboard.status}.`);
  const dashboardHtml = await dashboard.text();
  assert(!dashboardHtml.includes(ownTour.order.customer.companyName), "Dashboard zeigt den Firmennamen des Kunden.");
  assert(!dashboardHtml.includes("order.customer"), "Dashboard enthaelt einen Kundendaten-Ausdruck.");

  const detail = await fetchLocal(`/distributor/tours/${ownTour.id}`, { headers: { cookie } });
  assert(detail.status === 200, `Verteiler-Tourdetail lieferte ${detail.status}.`);
  const detailHtml = await detail.text();
  assert(!detailHtml.includes(ownTour.order.customer.companyName), "Tourdetail zeigt den Firmennamen des Kunden.");
} finally {
  if (server) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      server.kill();
    }
  }
  await prisma.$disconnect();
}

console.log("Verteiler-Privacy-Smoke erfolgreich abgeschlossen.");
