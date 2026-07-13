import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const PASSWORD = "DemoPasswort123!";
const TEST_PORT = process.env.ROUTE_ANALYSIS_PRIVACY_PORT || process.env.PORT || "3043";
let baseUrl = process.env.ROUTE_ANALYSIS_PRIVACY_BASE_URL || `http://localhost:${TEST_PORT}`;
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
    return await fetch(`${baseUrl}${path}`, { redirect: "manual", ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureServer() {
  for (const candidate of [baseUrl, "http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]) {
    try {
      baseUrl = candidate;
      const response = await fetchLocal("/", { timeoutMs: 2500 });
      if (response.status < 500) return null;
    } catch {
      // Kandidat ist nicht erreichbar.
    }
  }
  baseUrl = process.env.ROUTE_ANALYSIS_PRIVACY_BASE_URL || `http://localhost:${TEST_PORT}`;
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
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  else child.kill();
  throw new Error("Dev-Server konnte fuer den Route-Analysis-Privacy-Smoke nicht gestartet werden.");
}

async function login(email) {
  const response = await fetchLocal("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.233" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (response.status !== 200) throw new Error(`Login fehlgeschlagen: ${response.status} ${await response.text()}`);
  return cookieHeaderFrom(response);
}

const routeSource = await readFile("src/app/api/tours/[id]/route-analysis/route.ts", "utf8");
assert(routeSource.includes("findFirst"), "Route-Analyse verwendet keinen Zugriffsscope.");
assert(routeSource.includes("customer: { userId: session.id }"), "Customer-Tenant-Scope fehlt.");
assert(routeSource.includes("distributor: { userId: session.id }"), "Distributor-Scope fehlt.");
assert(!routeSource.includes("customer: true"), "Route-Analyse laedt weiterhin das komplette Kundenobjekt.");

const tours = await prisma.distributionTour.findMany({
  include: { order: { select: { customer: { select: { user: { select: { email: true } } } } } } },
  orderBy: { createdAt: "asc" },
  take: 50,
});
const ownTour = tours.find((tour) => tour.order.customer.user.email === "kunde.immobilien@example.com");
const foreignTour = tours.find((tour) => tour.order.customer.user.email !== "kunde.immobilien@example.com");
assert(ownTour, "Eigene Tour fuer den Route-Analysis-Privacy-Test fehlt.");
assert(foreignTour, "Fremde Tour fuer den Route-Analysis-Privacy-Test fehlt.");

const server = await ensureServer();
try {
  const cookie = await login("kunde.immobilien@example.com");
  const own = await fetchLocal(`/api/tours/${ownTour.id}/route-analysis`, { headers: { cookie } });
  assert(own.status === 200, `Eigene Route-Analyse lieferte ${own.status}.`);
  const foreign = await fetchLocal(`/api/tours/${foreignTour.id}/route-analysis`, { headers: { cookie } });
  assert(foreign.status === 404, `Fremde Route-Analyse ist erreichbar: ${foreign.status}`);
} finally {
  if (server) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    else server.kill();
  }
  await prisma.$disconnect();
}

console.log("Route-Analysis-Privacy-Smoke erfolgreich abgeschlossen.");
