import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const port = process.env.PUBLIC_INQUIRY_TEST_PORT || "3038";
let baseUrl = process.env.PUBLIC_INQUIRY_BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let child = null;
let leadId = null;

async function waitForServer() {
  try {
    if ((await fetch(`${baseUrl}/api/health`)).ok) return;
  } catch {
    // Der konfigurierte Server ist noch nicht verfuegbar.
  }
  child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port, EMAIL_PROVIDER: "mock" },
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  baseUrl = `http://localhost:${port}`;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) return;
    } catch {
      // Server bootet noch.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Testserver wurde nicht erreichbar.");
}

async function post(body, headers = {}) {
  const response = await fetch(`${baseUrl}/api/leads`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${Date.now() % 200 + 20}`, ...headers },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

try {
  await waitForServer();

  const invalid = await post({
    name: "Ungültige Anfrage",
    email: "not-an-email",
    postalCode: "1234",
    message: "Ungültige Testdaten",
    source: "public-inquiry-runtime",
  });
  assert.equal(invalid.response.status, 400, "Ungültige Anfragefelder müssen serverseitig abgelehnt werden.");

  const idempotencyKey = `public-inquiry-runtime-${Date.now()}-key`;
  const input = {
    name: "Public Inquiry Runtime",
    companyName: "FLYERO Testbetrieb",
    email: `public-inquiry-${Date.now()}@example.org`,
    phone: "+49 261 000000",
    city: "Koblenz",
    postalCode: "56068",
    streetAddress: "Beispielstraße 1",
    flyerQuantity: 3000,
    startDate: "2026-08-01",
    endDate: "2026-08-08",
    flexibleSchedule: true,
    flyersAlreadyPrinted: true,
    flyerFormat: "DIN lang",
    targetGroup: "Haushalte",
    distributionMode: "Haushaltsverteilung",
    campaignGoal: "Runtime-Prüfung",
    message: "Bitte Gebiet und Zeitraum für eine Testanfrage prüfen.",
    source: "public-inquiry-runtime",
    idempotencyKey,
  };
  const first = await post(input);
  assert.equal(first.response.status, 201, `Anfrage konnte nicht gespeichert werden: ${JSON.stringify(first.body)}`);
  leadId = first.body.data.id;
  assert.match(first.body.data.inquiryNumber, /^ANF-\d{4}-[A-Z0-9]+$/);

  const stored = await prisma.lead.findUnique({ where: { id: leadId } });
  assert.equal(stored?.expectedFlyerQuantity, 3000);
  assert.equal(stored?.inquiryData?.postalCode, "56068");
  assert.equal(stored?.inquiryData?.flyersAlreadyPrinted, true);

  const duplicate = await post(input);
  assert.equal(duplicate.response.status, 201, "Ein wiederholter Request muss idempotent beantwortet werden.");
  assert.equal(duplicate.body.data.id, leadId, "Ein Wiederholungsrequest darf keinen zweiten Lead anlegen.");
  assert.equal(await prisma.lead.count({ where: { idempotencyKey } }), 1);

  const messages = await prisma.notificationMessage.findMany({
    where: { data: { path: ["leadId"], equals: leadId } },
    include: { queues: true },
  });
  assert.ok(messages.length >= 3, "Anfrage muss interne und externe Benachrichtigungen erzeugen.");
  assert.equal(messages.flatMap((message) => message.queues).filter((queue) => queue.recipientEmail === input.email).length, 1);
  const operationsMessage = messages.find((message) => message.subject === "Neuer Lead eingegangen.");
  assert.equal(operationsMessage?.data?.postalCode, "56068", "Betriebs-Mail muss die PLZ der Anfrage enthalten.");
  assert.equal(operationsMessage?.data?.flyerQuantity, 3000, "Betriebs-Mail muss die Flyeranzahl der Anfrage enthalten.");
  console.log("Public inquiry runtime checks passed.");
} finally {
  if (leadId) {
    const messages = await prisma.notificationMessage.findMany({ where: { data: { path: ["leadId"], equals: leadId } }, select: { id: true } });
    const messageIds = messages.map((message) => message.id);
    if (messageIds.length) {
      await prisma.notificationQueue.deleteMany({ where: { messageId: { in: messageIds } } });
      await prisma.notificationLog.deleteMany({ where: { messageId: { in: messageIds } } });
      await prisma.notificationMessage.deleteMany({ where: { id: { in: messageIds } } });
    }
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
  if (child) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    else child.kill();
  }
}
