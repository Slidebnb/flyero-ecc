import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const TEST_PORT = process.env.BETA_PORT || process.env.PORT || "3022";
let baseUrl = process.env.BETA_BASE_URL || `http://localhost:${TEST_PORT}`;
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);

  try {
    return await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { "content-type": "application/json" } : {}),
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
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
  ];

  for (const candidate of candidates) {
    try {
      const previousBaseUrl = baseUrl;
      baseUrl = candidate;
      const response = await fetchLocal("/", { timeoutMs: 3000 });
      if (response.status < 500) return null;
      baseUrl = previousBaseUrl;
    } catch {
      // Kandidat ist nicht erreichbar.
    }
  }

  baseUrl = process.env.BETA_BASE_URL || `http://localhost:${TEST_PORT}`;
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
  throw new Error("Dev-Server konnte fuer Modul 22 Smoke nicht gestartet werden.");
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
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) },
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

await includes("prisma/schema.prisma", ["model Document", "model DocumentVersion", "storageKey", "model PrintOrder", "model PrintPartner", "enum PrintStatus"]);
await includes("src/lib/documentStorage.ts", ["ALLOWED_DOCUMENT_EXTENSIONS", "DOCUMENT_MAX_FILE_SIZE_BYTES", "storeDocumentFile"]);
await includes("src/lib/documents.ts", ["createDocument", "addDocumentVersion", "approveDocument", "createPrintOrder", "updatePrintOrder", "getDocumentAnalytics"]);
await includes("src/lib/analytics.ts", ["getDocumentAnalytics", "printOrders"]);
await includes("README.md", ["Modul 22", "Dokumentenmanagement", "Druckprozess"]);
await includes("ARCHITECTURE_DECISIONS.md", ["Modul 22", "DMS", "Druckmodul"]);
await includes("package.json", ["test:module22"]);
await includes("src/app/customer/documents/page.tsx", [
  "Erst Kampagne starten",
  "Druckdaten können hochgeladen werden",
  "disabled={orders.length === 0}",
]);

for (const filePath of [
  "src/app/customer/documents/page.tsx",
  "src/app/customer/orders/[id]/documents/page.tsx",
  "src/app/admin/documents/page.tsx",
  "src/app/admin/print-partners/page.tsx",
  "src/app/admin/print-orders/page.tsx",
  "src/app/api/customer/documents/route.ts",
  "src/app/api/admin/documents/route.ts",
  "src/app/api/customer/print-orders/route.ts",
  "src/app/api/admin/print-orders/[id]/route.ts",
]) assert(existsSync(filePath), `${filePath} fehlt.`);

assert(await prisma.document.count() >= 80, "Mindestens 80 Seed-Dokumente fehlen.");
assert(await prisma.documentVersion.count() >= 120, "Mindestens 40 Zusatzversionen fehlen.");
assert(await prisma.printOrder.count() >= 25, "Mindestens 25 Druckauftraege fehlen.");
assert(await prisma.printPartner.count() >= 5, "Mindestens 5 Druckpartner fehlen.");

const server = await ensureServer();
try {
  const adminCookie = await login("admin@example.com");
  const customerCookie = await login("kunde.immobilien@example.com");
  const distributorCookie = await login("verteiler.approved1@example.com");

  for (const [path, cookie, marker] of [
    ["/customer/documents", customerCookie, "Dateien &amp; Druck"],
    ["/admin/documents", adminCookie, "Dokumentenzentrale"],
    ["/admin/print-partners", adminCookie, "Druckpartner"],
    ["/admin/print-orders", adminCookie, "Druckaufträge"],
  ]) {
    const response = await fetchLocal(path, { headers: { cookie } });
    assert(response.status === 200, `${path} lieferte ${response.status}`);
    assert((await response.text()).includes(marker), `${path} enthaelt keinen erwarteten Inhalt.`);
  }

  const order = await prisma.order.findFirst({ where: { customer: { user: { email: "kunde.immobilien@example.com" } } } });
  assert(order, "Kundenauftrag fuer Modul 22 Smoke fehlt.");
  const created = await jsonRequest("/api/customer/documents", {
    method: "POST",
    cookie: customerCookie,
    expected: [201],
    body: {
      orderId: order.id,
      documentType: "PRINT_FILE",
      title: "Module 22 Smoke Druckdatei",
      originalFilename: "module22-smoke.pdf",
      mimeType: "application/pdf",
      content: Buffer.from("%PDF-1.4\nPDF-Smoke-Datei\n%%EOF").toString("base64"),
    },
  });
  assert(created.data.status === "UNDER_REVIEW", "Dokument wurde nicht in Pruefung angelegt.");

  const version = await jsonRequest(`/api/customer/documents/${created.data.id}/version`, {
    method: "POST",
    cookie: customerCookie,
    expected: [201],
    body: { originalFilename: "module22-smoke-v2.pdf", mimeType: "application/pdf", content: Buffer.from("%PDF-1.4\nVersion 2\n%%EOF").toString("base64") },
  });
  assert(version.data.version === 2, "Versionierung hat nicht auf v2 erhoeht.");

  const currentDocument = await prisma.document.findUnique({
    where: { id: created.data.id },
    include: { versions: { orderBy: { version: "asc" } } },
  });
  assert(currentDocument?.versions.length === 2, "Dokumentversionen wurden nicht vollstaendig gespeichert.");
  assert(currentDocument.versions.every((item) => item.storageKey), "Jede neue Dokumentversion braucht einen eigenen Storage-Key.");

  const approved = await jsonRequest(`/api/admin/documents/${created.data.id}/approve`, {
    method: "POST",
    cookie: adminCookie,
    body: { message: "Smoke freigegeben." },
  });
  assert(approved.data.status === "APPROVED", "Dokument wurde nicht freigegeben.");

  const download = await fetchLocal(`/api/customer/documents/${created.data.id}/download`, { headers: { cookie: customerCookie } });
  assert(download.status === 200, `Download lieferte ${download.status}`);
  assert((await download.text()).includes("Version 2"), "Download liefert nicht die aktuelle Version.");

  const firstVersionDownload = await fetchLocal(`/api/customer/documents/${created.data.id}/download?version=1`, { headers: { cookie: customerCookie } });
  assert(firstVersionDownload.status === 200, `Download von Version 1 lieferte ${firstVersionDownload.status}`);
  assert((await firstVersionDownload.text()).includes("PDF-Smoke-Datei"), "Versionsdownload liefert nicht die unveraenderte Version 1.");

  const partner = await jsonRequest("/api/admin/print-partners", {
    method: "POST",
    cookie: adminCookie,
    expected: [201],
    body: { companyName: "Module 22 Smoke Print", email: "module22-print@example.com", address: "Koblenz" },
  });
  assert(partner.data.id, "Druckpartner wurde nicht erstellt.");

  const printOrder = await jsonRequest("/api/customer/print-orders", {
    method: "POST",
    cookie: customerCookie,
    expected: [201],
    body: {
      orderId: order.id,
      printFormat: "DIN_A5",
      paperType: "Bilderdruck",
      paperWeight: 135,
      colorMode: "4/4",
      doubleSided: true,
      folded: "NONE",
      finishing: "NONE",
      quantity: 2500,
      notes: "Module 22 Smoke Druckauftrag",
    },
  });
  assert(printOrder.data.status === "REQUESTED", "Druckauftrag wurde nicht angefragt.");

  const inProduction = await jsonRequest(`/api/admin/print-orders/${printOrder.data.id}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "IN_PRODUCTION", printerId: partner.data.id, estimatedNetPrice: 123.45, estimatedGrossPrice: 146.91 },
  });
  assert(inProduction.data.status === "IN_PRODUCTION", "Druckstatus Produktion wurde nicht gesetzt.");

  const received = await jsonRequest(`/api/admin/print-orders/${printOrder.data.id}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "RECEIVED_IN_WAREHOUSE", trackingNumber: "M22-SMOKE" },
  });
  assert(received.data.warehouseInventoryId, "Lagerintegration hat keinen Bestand verknuepft.");
  const inventory = await prisma.warehouseInventory.findUnique({ where: { id: received.data.warehouseInventoryId } });
  assert(inventory?.receivedFlyers === 2500, "Warehouse Bestand wurde nicht erhoeht.");

  const adminDocuments = await jsonRequest("/api/admin/documents?q=Module%2022%20Smoke", { cookie: adminCookie });
  assert(adminDocuments.data.length >= 1, "Admin Dokumentensuche findet Smoke-Dokument nicht.");
  const customerDocuments = await jsonRequest("/api/customer/documents", { cookie: customerCookie });
  assert(customerDocuments.data.some((item) => item.id === created.data.id), "Customer sieht eigenes Dokument nicht.");

  const forbiddenAdminDocs = await fetchLocal("/api/admin/documents", { headers: { cookie: customerCookie } });
  assert(forbiddenAdminDocs.status === 403, "Customer darf Admin-Dokumente nicht sehen.");
  const forbiddenCustomerDocs = await fetchLocal("/api/customer/documents", { headers: { cookie: distributorCookie } });
  assert(forbiddenCustomerDocs.status === 403, "Distributor darf Customer-Dokumente nicht sehen.");

  const analytics = await jsonRequest("/api/admin/analytics", { cookie: adminCookie });
  assert("documents" in analytics.data, "Dokumenten-Analytics fehlen.");
  assert(analytics.data.summary.documents >= 1, "Dokumenten-Summary fehlt.");
  assert("averagePrintProcessDays" in analytics.data.documents, "Druckzeit-KPI fehlt.");
  const auditCount = await prisma.auditLog.count({ where: { action: { in: ["document.uploaded", "document.approved", "document.version_uploaded", "print.requested", "print.production_started", "print.received"] } } });
  assert(auditCount >= 6, "AuditLogs fuer Dokumente/Druck fehlen.");
  const notificationCount = await prisma.notification.count({ where: { type: { in: ["DOCUMENT_UPLOADED", "DOCUMENT_APPROVED", "PRINT_ORDER_REQUESTED", "PRINT_PRODUCTION_STARTED", "PRINT_SHIPPED", "PRINT_RECEIVED_IN_WAREHOUSE", "PRINT_STATUS_UPDATED"] } } });
  assert(notificationCount >= 3, "Notifications fuer Dokumente/Druck fehlen.");

  runCheck("npx", ["prisma", "validate"]);
  runCheck("npm", ["run", "lint"]);
  runCheck("npm", ["run", "build"]);
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

console.log("Modul 22 Smoke-Test erfolgreich abgeschlossen.");
