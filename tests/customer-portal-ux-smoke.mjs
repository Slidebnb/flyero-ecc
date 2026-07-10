import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

let baseUrl = process.env.CUSTOMER_PORTAL_BASE_URL || "http://localhost:3000";
const PASSWORD = "DemoPasswort123!";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timer);
  }
}

async function ensureServer() {
  for (const candidate of [baseUrl, "http://localhost:3000", "http://localhost:3001", "http://localhost:3025"]) {
    try {
      baseUrl = candidate;
      const response = await fetchWithTimeout(`${baseUrl}/api/health`);
      if (response.status < 500) return null;
    } catch {}
  }

  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: new URL(baseUrl).port || "3000" },
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  for (let attempt = 0; attempt < 45; attempt += 1) {
    await sleep(1000);
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/health`);
      if (response.status < 500) return child;
    } catch {}
  }
  child.kill();
  throw new Error("Dev-Server konnte fuer Kundenportal-UX nicht gestartet werden.");
}

function cookieHeaderFrom(response) {
  return (response.headers.get("set-cookie") || "").split(/,(?=[^;,]+=)/).map((item) => item.split(";")[0]).join("; ");
}

async function login(email) {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert(response.status === 200, `Login fehlgeschlagen fuer ${email}: ${response.status} ${await response.text()}`);
  return cookieHeaderFrom(response);
}

async function customerPage(path, cookie) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, { headers: { cookie } });
  const html = await response.text();
  assert(response.status === 200, `${path} liefert ${response.status}`);
  return html;
}

function assertCustomerLanguage(html, path) {
  for (const forbidden of ["Seed Modul", "Smoke-Test", "Checkout Smoke", "seed.module", "EXTERNAL_GPS_REPORT", "OrderStatus", "ReportStatus", "#DISP-", "#ORD-", "#WH-", "FLY-TK-"]) {
    assert(!html.includes(forbidden), `${path} zeigt technischen Rohtext: ${forbidden}`);
  }
  for (const required of ["customerUnifiedShell", "Neue Kampagne"]) {
    assert(html.includes(required), `${path} enthaelt nicht: ${required}`);
  }
}

const server = await ensureServer();
try {
  const cookie = await login("kunde.immobilien@example.com");
  const customerWhere = { customer: { user: { email: "kunde.immobilien@example.com" } } };
  const [order, invoice, report, ticket] = await Promise.all([
    prisma.order.findFirst({
      where: customerWhere,
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.invoice.findFirst({
      where: customerWhere,
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.report.findFirst({
      where: { status: "PUBLISHED", order: customerWhere, tour: { status: "APPROVED" } },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.supportTicket.findFirst({
      where: customerWhere,
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const routes = [
    "/customer/dashboard",
    "/customer/orders",
    "/customer/reports",
    "/customer/documents",
    "/customer/invoices",
    "/customer/payments",
    "/customer/notifications",
    "/customer/support",
    "/customer/profile",
  ];
  if (order) {
    routes.push(`/customer/orders/${order.id}`);
    routes.push(`/customer/orders/${order.id}/documents`);
  }
  if (invoice) routes.push(`/customer/invoices/${invoice.id}`);
  if (report) routes.push(`/customer/reports/${report.id}`);
  if (ticket) routes.push(`/customer/support/tickets/${ticket.id}`);
  for (const route of routes) {
    assertCustomerLanguage(await customerPage(route, cookie), route);
  }
  console.log("Customer portal UX smoke checks passed.");
} finally {
  await prisma.$disconnect();
  if (server) server.kill();
}
