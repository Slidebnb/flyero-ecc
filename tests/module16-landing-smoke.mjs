import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const TEST_PORT = process.env.BETA_PORT || process.env.PORT || "3016";
let baseUrl = process.env.BETA_BASE_URL || `http://localhost:${TEST_PORT}`;
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);

  try {
    return await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { "content-type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureServer() {
  const candidates = [
    baseUrl,
    "http://localhost:3025",
    "http://localhost:3024",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
  ];

  for (const candidate of candidates) {
    try {
      baseUrl = candidate;
      const response = await fetchLocal("/", { timeoutMs: 3000 });
      if (response.status < 500) return null;
    } catch {
      // Kandidat ist nicht erreichbar.
    }
  }

  baseUrl = process.env.BETA_BASE_URL || `http://localhost:${TEST_PORT}`;
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: TEST_PORT },
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
  throw new Error("Dev-Server konnte fuer Modul 16 Smoke nicht gestartet werden.");
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

await includes("prisma/schema.prisma", ["model Lead", "enum LeadStatus", "enum LeadType", "adminNote", "archivedAt"]);
await includes("src/lib/leads.ts", ["lead.created", "LEAD_CREATED", "notifyAdmins"]);
await includes("README.md", ["Modul 16", "Landingpage", "Leadflow"]);
await includes("ARCHITECTURE_DECISIONS.md", ["Modul 16", "Lead-Modell", "rechtliche Seiten"]);
await includes("package.json", ["test:module16-landing"]);
await includes("src/app/PortalComponents.tsx", ["PortalShell", "PortalHeader", "PortalNav", "MetricTile", "ActionPanel", "DataSection", "StatusBadge", "EmptyState"]);
await includes("src/app/customer/dashboard/page.tsx", ["PortalShell", "MetricTile", "ActionPanel"]);
await includes("src/app/warehouse/dashboard/page.tsx", ["PortalShell", "MetricTile", "DataSection"]);
await includes("src/app/distributor/dashboard/page.tsx", ["PortalShell", "StatusBadge", "EmptyState"]);
await includes("src/app/admin/dashboard/page.tsx", ["PortalShell", "MetricTile", "DataSection"]);
await includes("src/app/verteilung-anfragen/page.tsx", [
  "Unverbindlich anfragen",
  "Online Buchung ansehen",
  "next=${directBookingParam}",
]);
await includes("src/app/seo.ts", ["publicSeoRoutes", "createJsonLd", "noIndexMetadata"]);
await includes("src/app/sitemap.ts", ["MetadataRoute.Sitemap", "publicSeoRoutes"]);
await includes("src/app/robots.ts", ["MetadataRoute.Robots", "disallow"]);
await includes("src/app/layout.tsx", ["application/ld+json"]);
await includes("src/app/login/page.tsx", ["noIndexMetadata"]);
await includes("src/app/register/customer/page.tsx", ["noIndexMetadata"]);
await includes("src/app/register/distributor/page.tsx", ["noIndexMetadata"]);
await includes("src/app/verify-email/page.tsx", ["noIndexMetadata"]);

const landingSource = await readFile("src/app/page.tsx", "utf8");
assert(!landingSource.includes("Lokale Kampagnen mit messbarem Gebietsfokus"), "Zielgruppen enthalten noch den wiederholten Fülltext.");
assert(!landingSource.includes("FLYERO Startup Unternehmen"), "Unprofessionelle Startup-Platzhalter-Sprache ist noch sichtbar.");

for (const filePath of [
  "src/app/page.tsx",
  "src/app/fuer-unternehmen/page.tsx",
  "src/app/fuer-verteiler/page.tsx",
  "src/app/preise/page.tsx",
  "src/app/so-funktionierts/page.tsx",
  "src/app/verteilung-anfragen/page.tsx",
  "src/app/kontakt/page.tsx",
  "src/app/impressum/page.tsx",
  "src/app/datenschutz/page.tsx",
  "src/app/agb/page.tsx",
  "src/app/admin/leads/page.tsx",
  "src/app/api/leads/route.ts",
  "src/app/api/admin/leads/route.ts",
  "src/app/api/admin/leads/[id]/route.ts",
]) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
}

const server = await ensureServer();
try {
  for (const path of ["/", "/fuer-unternehmen", "/fuer-verteiler", "/preise", "/so-funktionierts", "/verteilung-anfragen", "/kontakt", "/impressum", "/datenschutz", "/agb"]) {
    const response = await fetchLocal(path);
    assert(response.status === 200, `${path} lieferte ${response.status}`);
    const html = await response.text();
    assert(!html.includes("Google Maps Key fehlt"), `${path} zeigt unerwarteten Google-Key-Fehler.`);
    assert(!html.includes("Lokale Kampagnen mit messbarem Gebietsfokus"), `${path} enthält wiederholten Zielgruppen-Fülltext.`);
  }

  const robots = await fetchLocal("/robots.txt");
  assert(robots.status === 200, `/robots.txt lieferte ${robots.status}`);
  const robotsText = await robots.text();
  assert(robotsText.includes("Sitemap:"), "robots.txt verweist nicht auf sitemap.xml.");
  assert(robotsText.includes("Disallow: /api/"), "robots.txt blockiert API-Routen nicht.");
  assert(robotsText.includes("Disallow: /customer/"), "robots.txt blockiert Kundenportal nicht.");

  const sitemap = await fetchLocal("/sitemap.xml");
  assert(sitemap.status === 200, `/sitemap.xml lieferte ${sitemap.status}`);
  const sitemapText = await sitemap.text();
  for (const publicPath of ["/verteilung-anfragen", "/fuer-unternehmen", "/fuer-verteiler", "/preise", "/kontakt"]) {
    assert(sitemapText.includes(publicPath), `sitemap.xml enthaelt ${publicPath} nicht.`);
  }

  for (const authPath of ["/login", "/register/customer", "/register/distributor", "/verify-email"]) {
    const response = await fetchLocal(authPath);
    assert(response.status === 200, `${authPath} lieferte ${response.status}`);
    const html = await response.text();
    assert(html.includes("noindex"), `${authPath} ist nicht als noindex markiert.`);
  }

  const requestPage = await fetchLocal("/verteilung-anfragen");
  const requestHtml = await requestPage.text();
  assert(requestHtml.includes("Unverbindlich anfragen"), "/verteilung-anfragen zeigt keine öffentliche Anfrageoption.");
  assert(requestHtml.includes("Online Buchung ansehen"), "/verteilung-anfragen zeigt keine Online-Buchungsoption.");
  assert(requestHtml.includes("next=%2Fcustomer%2Forders%2Fnew"), "/verteilung-anfragen verlinkt Direktbuchung nicht mit next-Parameter.");

  const protectedOrder = await fetchLocal("/customer/orders/new");
  assert([302, 303, 307, 308].includes(protectedOrder.status), `/customer/orders/new ist ohne Login nicht geschützt: ${protectedOrder.status}`);
  const protectedLocation = protectedOrder.headers.get("location") || "";
  assert(protectedLocation.includes("/login") && protectedLocation.includes("next=%2Fcustomer%2Forders%2Fnew"), "Direkte Auftragserstellung leitet nicht sauber zum Login mit next weiter.");

  const unique = Date.now();
  const created = await jsonRequest("/api/leads", {
    method: "POST",
    expected: [201],
    body: {
      type: "CUSTOMER",
      name: "Module 16 Smoke",
      companyName: "Smoke Test GmbH",
      email: `module16.${unique}@example.com`,
      phone: "+49 261 160000",
      city: "Koblenz",
      message: "Bitte Angebot fuer eine testbare Flyerverteilung.",
      source: "module16-smoke",
    },
  });
  assert(created.data.id, "Lead-Erstellung lieferte keine ID.");

  const adminCookie = await loginAdmin();
  const list = await jsonRequest("/api/admin/leads", { cookie: adminCookie });
  assert(Array.isArray(list.data), "Admin-Leads liefert keine Liste.");
  assert(list.data.some((lead) => lead.id === created.data.id), "Neu erstellter Lead fehlt in Admin-Liste.");

  const patched = await jsonRequest(`/api/admin/leads/${created.data.id}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "CONTACTED", adminNote: "Smoke-Test kontaktiert.", archive: false },
  });
  assert(patched.data.status === "CONTACTED", "Lead-Status wurde nicht geaendert.");
  assert(patched.data.adminNote === "Smoke-Test kontaktiert.", "Lead-Notiz wurde nicht gespeichert.");

  const [seedLeadCount, leadTypeCount, leadStatusCount, auditCount, notificationCount] = await Promise.all([
    prisma.lead.count({ where: { source: "seed:module16" } }),
    prisma.lead.groupBy({ by: ["type"], _count: { type: true }, where: { source: "seed:module16" } }),
    prisma.lead.groupBy({ by: ["status"], _count: { status: true }, where: { source: "seed:module16" } }),
    prisma.auditLog.count({ where: { action: "lead.created" } }),
    prisma.notification.count({ where: { type: "LEAD_CREATED" } }),
  ]);
  assert(seedLeadCount >= 20, "20 Seed-Leads fehlen.");
  assert(leadTypeCount.length >= 4, "Seed-Leads decken nicht alle Lead-Typen ab.");
  assert(leadStatusCount.length >= 5, "Seed-Leads decken nicht alle Lead-Status ab.");
  assert(auditCount >= 1, "lead.created AuditLog fehlt.");
  assert(notificationCount >= 1, "Admin-Notification fuer Lead-Erstellung fehlt.");

  console.log("Module 16 landing smoke checks passed.");
} finally {
  await prisma.$disconnect();
  if (server) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      server.kill();
    }
  }
}
