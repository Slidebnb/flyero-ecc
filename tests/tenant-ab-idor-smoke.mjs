import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const port = process.env.TENANT_AB_PORT || "3037";
const sharedBaseUrl = process.env.TENANT_AB_BASE_URL || "";
const baseUrl = sharedBaseUrl || `http://localhost:${port}`;
const password = "DemoPasswort123!";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let server = null;

function assertResponseStatus(response, allowed, label) {
  assert(allowed.includes(response.status), `${label}: erwartete ${allowed.join("/")}, bekam ${response.status}`);
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
  throw new Error(`A/B-IDOR-Testserver auf ${baseUrl} konnte nicht gestartet werden.`);
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...options,
    headers: { ...(options.headers || {}) },
  });
}

async function login(email, ip) {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email, password }),
  });
  assertResponseStatus(response, [200], `Login ${email}`);
  const setCookie = response.headers.get("set-cookie");
  assert(setCookie, `Login ${email} hat kein Session-Cookie geliefert.`);
  return setCookie.split(/,(?=[^;,]+=)/).map((item) => item.split(";")[0]).join("; ");
}

async function json(path, cookie) {
  const response = await request(path, { headers: { cookie } });
  assertResponseStatus(response, [200], `GET ${path}`);
  return response.json();
}

async function assertForeignDenied(path, cookie) {
  const response = await request(path, { headers: { cookie } });
  assertResponseStatus(response, [403, 404], `Fremdzugriff ${path}`);
}

try {
  const candidates = await prisma.customerProfile.findMany({
    where: { user: { role: "CUSTOMER" } },
    select: { id: true, tenantId: true, user: { select: { email: true } } },
    orderBy: { createdAt: "asc" },
  });
  const withOrders = [];
  for (const customer of candidates) {
    const order = await prisma.order.findFirst({ where: { customerId: customer.id, tenantId: customer.tenantId }, select: { id: true } });
    if (order) withOrders.push({ ...customer, orderId: order.id });
    if (withOrders.length === 2) break;
  }
  assert(withOrders.length === 2, "A/B-IDOR-Smoke braucht zwei Kunden mit getrennten Aufträgen.");

  if (!sharedBaseUrl) await startServer();
  const customerA = withOrders[0];
  const customerB = withOrders[1];
  const cookieA = await login(customerA.user.email, "198.51.100.41");
  const cookieB = await login(customerB.user.email, "198.51.100.42");

  const listChecks = [
    ["orders", "/api/customer/orders"],
    ["reports", "/api/customer/reports"],
    ["invoices", "/api/customer/invoices"],
    ["payments", "/api/customer/payments"],
    ["documents", "/api/customer/documents"],
  ];
  for (const [label, path] of listChecks) {
    const a = await json(path, cookieA);
    const b = await json(path, cookieB);
    assert(Array.isArray(a.data), `${label}: Kunde A erhält keine Liste.`);
    assert(Array.isArray(b.data), `${label}: Kunde B erhält keine Liste.`);
    if (label === "orders") {
      assert(!a.data.some((item) => item.id === customerB.orderId), `${label}: Kunde A sieht Auftrag von Kunde B.`);
      assert(!b.data.some((item) => item.id === customerA.orderId), `${label}: Kunde B sieht Auftrag von Kunde A.`);
    }
    if (["invoices", "payments", "documents"].includes(label)) {
      assert(!a.data.some((item) => item.customerId && item.customerId !== customerA.id), `${label}: Kunde A sieht fremde Kundendaten.`);
      assert(!b.data.some((item) => item.customerId && item.customerId !== customerB.id), `${label}: Kunde B sieht fremde Kundendaten.`);
    }
  }

  await assertForeignDenied(`/api/customer/orders/${customerB.orderId}`, cookieA);
  await assertForeignDenied(`/api/customer/orders/${customerA.orderId}`, cookieB);
  await assertForeignDenied(`/api/customer/orders/${customerB.orderId}/documents`, cookieA);
  await assertForeignDenied(`/api/customer/orders/${customerA.orderId}/documents`, cookieB);

  const foreignInvoice = await prisma.invoice.findFirst({ where: { customerId: customerB.id, tenantId: customerB.tenantId }, select: { id: true } });
  if (foreignInvoice) {
    await assertForeignDenied(`/api/customer/invoices/${foreignInvoice.id}`, cookieA);
    await assertForeignDenied(`/api/customer/invoices/${foreignInvoice.id}/download`, cookieA);
  }
  const foreignPayment = await prisma.payment.findFirst({ where: { customerId: customerB.id, tenantId: customerB.tenantId }, select: { id: true } });
  if (foreignPayment) await assertForeignDenied(`/api/customer/payments/${foreignPayment.id}`, cookieA);
  const foreignDocument = await prisma.document.findFirst({ where: { customerId: customerB.id, tenantId: customerB.tenantId }, select: { id: true } });
  if (foreignDocument) {
    await assertForeignDenied(`/api/customer/documents/${foreignDocument.id}`, cookieA);
    await assertForeignDenied(`/api/customer/documents/${foreignDocument.id}/download`, cookieA);
  }
  const foreignReport = await prisma.report.findFirst({ where: { customerId: customerB.id, tenantId: customerB.tenantId, status: "PUBLISHED" }, select: { id: true } });
  if (foreignReport) {
    await assertForeignDenied(`/api/customer/reports/${foreignReport.id}`, cookieA);
    await assertForeignDenied(`/api/customer/reports/${foreignReport.id}/download`, cookieA);
  }

  console.log("Tenant A/B IDOR smoke checks passed.");
} finally {
  if (server) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    else server.kill();
  }
  await prisma.$disconnect();
}
