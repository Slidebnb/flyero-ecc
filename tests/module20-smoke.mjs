import { spawn, spawnSync } from "node:child_process";
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
  throw new Error("Dev-Server konnte fuer Modul 20 Smoke nicht gestartet werden.");
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
  "enum LeadPriority",
  "OFFER_SENT",
  "TEST_ORDER_PLANNED",
  "model LeadNote",
  "model LeadActivity",
  "assignedToId",
  "wonCustomerId",
]);
await includes("src/lib/crm.ts", [
  "listCrmLeads",
  "changeLeadStatus",
  "addLeadNote",
  "convertLeadToCustomer",
  "getCrmFollowups",
  "LEAD_FOLLOWUP_DUE",
]);
await includes("src/lib/analytics.ts", ["leadsByStatus", "conversionRate", "newLeadsByWeek", "openFollowUps"]);
await includes("README.md", ["Modul 20", "CRM Pipeline", "Leadstatus", "Follow-ups", "Lead zu Kunde"]);
await includes("ARCHITECTURE_DECISIONS.md", ["Modul 20", "Mini-CRM", "externe CRM-Integration", "Conversion"]);
await includes("package.json", ["test:module20"]);

for (const filePath of [
  "src/app/admin/crm/page.tsx",
  "src/app/admin/crm/leads/[id]/page.tsx",
  "src/app/admin/crm/followups/page.tsx",
  "src/app/api/admin/crm/leads/route.ts",
  "src/app/api/admin/crm/leads/[id]/route.ts",
  "src/app/api/admin/crm/leads/[id]/note/route.ts",
  "src/app/api/admin/crm/leads/[id]/status/route.ts",
  "src/app/api/admin/crm/leads/[id]/assign/route.ts",
  "src/app/api/admin/crm/leads/[id]/convert/route.ts",
  "src/app/api/admin/crm/followups/route.ts",
]) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
}

const seedLeadCount = await prisma.lead.count({ where: { source: "seed.module20" } });
assert(seedLeadCount >= 50, "50 Modul-20-Seed-Leads fehlen.");
const [noteCount, activityCount] = await Promise.all([
  prisma.leadNote.count(),
  prisma.leadActivity.count(),
]);
assert(noteCount >= 50, "LeadNotes fehlen.");
assert(activityCount >= 50, "LeadActivities fehlen.");

const server = await ensureServer();
try {
  const adminCookie = await login("admin@example.com");
  const customerCookie = await login("kunde.immobilien@example.com");
  const distributorCookie = await login("verteiler.approved1@example.com");

  for (const path of ["/admin/crm", "/admin/crm/followups"]) {
    const response = await fetchLocal(path, { headers: { cookie: adminCookie } });
    assert(response.status === 200, `${path} lieferte ${response.status}`);
    const html = await response.text();
    assert(html.includes("CRM") || html.includes("Follow-ups"), `${path} enthaelt keinen CRM-Inhalt.`);
  }

  const list = await jsonRequest("/api/admin/crm/leads?archived=all", { cookie: adminCookie });
  assert(Array.isArray(list.data.leads), "CRM Lead-Liste fehlt.");
  const lead = list.data.leads.find((item) => item.source === "seed.module20" && item.status !== "WON" && item.status !== "ARCHIVED") ?? list.data.leads[0];
  assert(lead?.id, "Kein CRM Lead gefunden.");

  const detailPage = await fetchLocal(`/admin/crm/leads/${lead.id}`, { headers: { cookie: adminCookie } });
  assert(detailPage.status === 200, "Lead-Detailseite nicht erreichbar.");
  const detail = await jsonRequest(`/api/admin/crm/leads/${lead.id}`, { cookie: adminCookie });
  assert(detail.data.id === lead.id, "Lead-Detail API liefert falschen Lead.");

  const patched = await jsonRequest(`/api/admin/crm/leads/${lead.id}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: {
      priority: "URGENT",
      nextFollowUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      expectedFlyerQuantity: 7777,
      estimatedOrderVolume: 888.5,
      notes: "Module 20 Smoke Pipeline Update.",
    },
  });
  assert(patched.data.priority === "URGENT", "Prioritaet wurde nicht gespeichert.");
  assert(patched.data.expectedFlyerQuantity === 7777, "Follow-up/Potenzial wurde nicht gespeichert.");

  const assigned = await jsonRequest(`/api/admin/crm/leads/${lead.id}/assign`, {
    method: "POST",
    cookie: adminCookie,
    body: { assignedToId: null },
  });
  assert(assigned.data.assignedToId === null, "Zuweisung wurde nicht geloest.");

  const note = await jsonRequest(`/api/admin/crm/leads/${lead.id}/note`, {
    method: "POST",
    cookie: adminCookie,
    expected: [201],
    body: { body: "Module 20 Smoke Notiz." },
  });
  assert(note.data.body.includes("Smoke"), "Notiz wurde nicht gespeichert.");

  for (const status of ["CONTACTED", "QUALIFIED", "OFFER_SENT", "TEST_ORDER_PLANNED"]) {
    const changed = await jsonRequest(`/api/admin/crm/leads/${lead.id}/status`, {
      method: "POST",
      cookie: adminCookie,
      body: { status, detail: `Smoke ${status}` },
    });
    assert(changed.data.status === status, `Status ${status} wurde nicht gesetzt.`);
  }

  const lostLead = list.data.leads.find((item) => item.source === "seed.module20" && item.id !== lead.id && item.status !== "WON") ?? lead;
  const lost = await jsonRequest(`/api/admin/crm/leads/${lostLead.id}/status`, {
    method: "POST",
    cookie: adminCookie,
    body: { status: "LOST", lostReason: "Smoke verloren." },
  });
  assert(lost.data.status === "LOST", "Lead verloren wurde nicht gesetzt.");

  const convertLead = list.data.leads.find((item) => item.source === "seed.module20" && item.id !== lead.id && item.id !== lostLead.id) ?? lead;
  const converted = await jsonRequest(`/api/admin/crm/leads/${convertLead.id}/convert`, {
    method: "POST",
    cookie: adminCookie,
  });
  assert(converted.data.customerId, "Convert hat keine customerId geliefert.");
  assert(converted.data.lead.wonCustomerId, "wonCustomerId wurde nicht gespeichert.");

  const followups = await jsonRequest("/api/admin/crm/followups", { cookie: adminCookie });
  assert(Array.isArray(followups.data.today), "Follow-up heute fehlt.");
  assert(Array.isArray(followups.data.overdue), "Follow-up ueberfaellig fehlt.");
  assert(Array.isArray(followups.data.thisWeek), "Follow-up Woche fehlt.");
  assert(Array.isArray(followups.data.withoutFollowup), "Follow-up ohne Datum fehlt.");

  const analytics = await jsonRequest("/api/admin/analytics", { cookie: adminCookie });
  assert(Array.isArray(analytics.data.leads.leadsByStatus), "Analytics Leads nach Status fehlen.");
  assert(typeof analytics.data.leads.conversionRate === "number", "Analytics Conversion Rate fehlt.");
  assert(Array.isArray(analytics.data.leads.newLeadsByWeek), "Analytics Leads pro Woche fehlen.");
  assert(typeof analytics.data.summary.openFollowUps === "number", "Analytics offene Follow-ups fehlen.");

  const customerCrm = await fetchLocal("/admin/crm", { headers: { cookie: customerCookie } });
  assert([302, 303, 307, 308, 403].includes(customerCrm.status), "Customer darf CRM nicht sehen.");
  const distributorCrm = await fetchLocal("/api/admin/crm/leads", { headers: { cookie: distributorCookie } });
  assert([302, 303, 307, 308, 403].includes(distributorCrm.status), "Distributor darf CRM API nicht sehen.");

  const [auditCount, notificationCount] = await Promise.all([
    prisma.auditLog.count({ where: { action: { in: ["lead.updated", "lead.status_changed", "lead.note_added", "lead.converted", "lead.won", "lead.lost", "lead.followup_set"] } } }),
    prisma.notification.count({ where: { type: { in: ["LEAD_CREATED", "LEAD_FOLLOWUP_DUE", "LEAD_WON", "LEAD_LOST"] } } }),
  ]);
  assert(auditCount >= 4, "CRM AuditLogs fehlen.");
  assert(notificationCount >= 4, "CRM Notifications fehlen.");

  runCheck("npm", ["run", "lint"]);
  runCheck("npm", ["run", "build"]);

  console.log("Module 20 CRM smoke checks passed.");
} finally {
  await prisma.$disconnect();
  if (server) server.kill();
}
