import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE_URL = process.env.BETA_BASE_URL || "http://localhost:3000";
const PASSWORD = "DemoPasswort123!";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function includes(filePath, snippets) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
  const content = await readFile(filePath, "utf8");
  for (const snippet of snippets) assert(content.includes(snippet), `${filePath} enthaelt nicht: ${snippet}`);
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
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(1000);
    try {
      const response = await fetchLocal("/");
      if (response.status < 500) return child;
    } catch {
      // Server bootet noch.
    }
  }
  child.kill();
  throw new Error("Dev-Server konnte fuer Modul 21 Smoke nicht gestartet werden.");
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

function runCheck(command, args) {
  const result = spawnSync(process.platform === "win32" ? `${command}.cmd` : command, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  assert(result.status === 0, `${command} ${args.join(" ")} fehlgeschlagen:\n${result.stdout}\n${result.stderr}`);
}

await includes("prisma/schema.prisma", [
  "enum TicketType",
  "enum TicketPriority",
  "enum TicketMessageVisibility",
  "model TicketMessage",
  "model TicketAttachment",
  "ticketNumber",
  "ticketNextNumber",
]);
await includes("src/lib/support.ts", [
  "createTicket",
  "addTicketMessage",
  "updateTicket",
  "getSupportAnalytics",
  "TicketMessageVisibility.PUBLIC",
]);
await includes("src/lib/analytics.ts", ["support", "openSupportTickets", "urgentSupportTickets"]);
await includes("README.md", ["Modul 21", "Support-Tickets", "TicketMessage"]);
await includes("ARCHITECTURE_DECISIONS.md", ["Modul 21", "Support-Tickets", "Reklamationen"]);
await includes("package.json", ["test:module21"]);

for (const filePath of [
  "src/app/admin/support/page.tsx",
  "src/app/admin/support/tickets/[id]/page.tsx",
  "src/app/customer/support/page.tsx",
  "src/app/customer/support/tickets/[id]/page.tsx",
  "src/app/distributor/support/page.tsx",
  "src/app/distributor/support/tickets/[id]/page.tsx",
  "src/app/api/admin/support/tickets/route.ts",
  "src/app/api/customer/support/tickets/route.ts",
  "src/app/api/distributor/support/tickets/route.ts",
]) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
}

const seededTickets = await prisma.supportTicket.count({ where: { subject: { startsWith: "Seed Modul 21" } } });
assert(seededTickets >= 30, "30 Modul-21-Seed-Tickets fehlen.");
assert(await prisma.ticketMessage.count() >= 60, "TicketMessages fehlen.");

const server = await ensureServer();
try {
  const adminCookie = await login("admin@example.com");
  const customerCookie = await login("kunde.immobilien@example.com");
  const distributorCookie = await login("verteiler.approved1@example.com");

  for (const [path, cookie, marker] of [
    ["/admin/support", adminCookie, "Support"],
    ["/customer/support", customerCookie, "Support"],
    ["/distributor/support", distributorCookie, "Support"],
  ]) {
    const response = await fetchLocal(path, { headers: { cookie } });
    assert(response.status === 200, `${path} lieferte ${response.status}`);
    assert((await response.text()).includes(marker), `${path} enthaelt keinen erwarteten Inhalt.`);
  }

  const customerOrder = await prisma.order.findFirst({ where: { customer: { user: { email: "kunde.immobilien@example.com" } } }, include: { reports: true, tours: true } });
  assert(customerOrder, "Kundenauftrag fuer Modul 21 Smoke fehlt.");
  const customerTicket = await jsonRequest("/api/customer/support/tickets", {
    method: "POST",
    cookie: customerCookie,
    expected: [201],
    body: {
      type: "CUSTOMER_SUPPORT",
      priority: "NORMAL",
      subject: "Module 21 Smoke Kundenticket",
      description: "Bitte diesen Auftrag im Smoke-Test pruefen.",
      orderId: customerOrder.id,
    },
  });
  assert(customerTicket.data.ticketNumber?.startsWith("FLY-TK-"), "Ticketnummer fehlt.");

  const report = customerOrder.reports[0] ?? await prisma.report.findFirst({ where: { customerId: customerOrder.customerId } });
  assert(report, "Report fuer Reklamation fehlt.");
  const complaint = await jsonRequest("/api/customer/support/tickets", {
    method: "POST",
    cookie: customerCookie,
    expected: [201],
    body: {
      type: "COMPLAINT",
      priority: "HIGH",
      subject: "Module 21 Smoke Reklamation",
      description: "Problem aus Kundenbericht im Smoke-Test.",
      reportId: report.id,
      orderId: report.orderId,
      tourId: report.tourId,
    },
  });
  assert(complaint.data.type === "COMPLAINT", "Reklamation wurde nicht erstellt.");

  const adminList = await jsonRequest("/api/admin/support/tickets?q=Module%2021%20Smoke", { cookie: adminCookie });
  assert(adminList.data.tickets.length >= 1, "Admin sieht Smoke-Ticket nicht.");

  const publicReply = await jsonRequest(`/api/admin/support/tickets/${customerTicket.data.id}/message`, {
    method: "POST",
    cookie: adminCookie,
    expected: [201],
    body: { visibility: "PUBLIC", message: "Oeffentliche Smoke-Antwort vom Support." },
  });
  assert(publicReply.data.visibility === "PUBLIC", "Oeffentliche Antwort fehlt.");

  const internalNote = await jsonRequest(`/api/admin/support/tickets/${customerTicket.data.id}/message`, {
    method: "POST",
    cookie: adminCookie,
    expected: [201],
    body: { visibility: "INTERNAL", message: "Interne Smoke-Notiz, nicht fuer Kunden." },
  });
  assert(internalNote.data.visibility === "INTERNAL", "Interne Notiz fehlt.");

  const customerDetail = await jsonRequest(`/api/customer/support/tickets/${customerTicket.data.id}`, { cookie: customerCookie });
  const customerText = JSON.stringify(customerDetail);
  assert(customerText.includes("Oeffentliche Smoke-Antwort"), "Kunde sieht oeffentliche Antwort nicht.");
  assert(!customerText.includes("Interne Smoke-Notiz"), "Kunde sieht interne Notiz.");

  const distributorTour = await prisma.distributionTour.findFirst({ where: { distributor: { user: { email: "verteiler.approved1@example.com" } } } });
  assert(distributorTour, "Verteilertour fuer Modul 21 Smoke fehlt.");
  const distributorTicket = await jsonRequest("/api/distributor/support/tickets", {
    method: "POST",
    cookie: distributorCookie,
    expected: [201],
    body: {
      type: "TOUR_ISSUE",
      priority: "HIGH",
      subject: "Module 21 Smoke Tourproblem",
      description: "Tourproblem aus dem Smoke-Test.",
      tourId: distributorTour.id,
    },
  });
  assert(distributorTicket.data.distributorId, "Verteiler-Ticket hat keinen Verteilerbezug.");

  const updated = await jsonRequest(`/api/admin/support/tickets/${customerTicket.data.id}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "IN_PROGRESS", priority: "URGENT", assignedToId: null },
  });
  assert(updated.data.status === "IN_PROGRESS", "Statuswechsel wurde nicht gespeichert.");
  assert(updated.data.priority === "URGENT", "Prioritaet wurde nicht gespeichert.");

  const closed = await jsonRequest(`/api/admin/support/tickets/${customerTicket.data.id}/close`, {
    method: "POST",
    cookie: adminCookie,
    body: { resolution: "Smoke-Test abgeschlossen." },
  });
  assert(closed.data.status === "CLOSED", "Ticket wurde nicht geschlossen.");

  const forbiddenAdmin = await fetchLocal("/api/admin/support/tickets", { headers: { cookie: customerCookie } });
  assert(forbiddenAdmin.status === 403, "Customer darf Admin-Support-API nicht sehen.");
  const forbiddenCustomer = await fetchLocal(`/api/customer/support/tickets/${distributorTicket.data.id}`, { headers: { cookie: customerCookie } });
  assert([403, 404].includes(forbiddenCustomer.status), "Customer darf Verteiler-Ticket nicht sehen.");

  const notifications = await prisma.notification.count({
    where: { type: { in: ["SUPPORT_TICKET_CREATED", "SUPPORT_TICKET_ANSWERED", "SUPPORT_TICKET_CLOSED", "URGENT_SUPPORT_TICKET"] } },
  });
  assert(notifications >= 1, "Support-Notifications fehlen.");
  const audits = await prisma.auditLog.count({ where: { action: { startsWith: "ticket." } } });
  assert(audits >= 4, "Ticket-AuditLogs fehlen.");
  const analytics = await jsonRequest("/api/admin/analytics", { cookie: adminCookie });
  assert("support" in analytics.data, "Support-Analytics fehlen.");
  assert("openSupportTickets" in analytics.data.summary, "Support-Summary fehlt.");

  runCheck("npx", ["prisma", "validate"]);
  runCheck("npm", ["run", "lint"]);
  runCheck("npm", ["run", "build"]);
} finally {
  if (server) server.kill();
  await prisma.$disconnect();
}

console.log("Modul 21 Smoke-Test erfolgreich abgeschlossen.");
