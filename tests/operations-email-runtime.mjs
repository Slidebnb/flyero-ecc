import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const port = process.env.OPERATIONS_EMAIL_TEST_PORT || "3028";
let baseUrl = process.env.BETA_BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let child = null;
let createdLeadId = null;
const testIp = `198.51.100.${(Date.now() % 200) + 20}`;

function rateLimitBucketId(scope, suffix, value) {
  return createHash("sha256").update(`flyero-auth-rate-limit:${scope}:${suffix}:${value}`).digest("hex");
}

function cookieHeader(response) {
  return (response.headers.get("set-cookie") || "").split(/,(?=[^;,]+=)/).map((part) => part.split(";")[0]).join("; ");
}

async function waitForServer() {
  const candidates = [baseUrl, "http://localhost:3000", "http://localhost:3001", `http://localhost:${port}`];
  for (const candidate of [...new Set(candidates)]) {
    try {
      const response = await fetch(`${candidate}/api/health`);
      if (response.ok) {
        baseUrl = candidate;
        return;
      }
    } catch {
      // Kandidat ist nicht erreichbar.
    }
  }

  child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port, EMAIL_PROVIDER: "mock", OPERATIONS_EMAIL: "hallo@flyero.org" },
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  baseUrl = `http://localhost:${port}`;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Server bootet noch.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Testserver wurde nicht erreichbar.");
}

try {
  await waitForServer();
  await prisma.authRateLimitBucket.deleteMany({
    where: {
      id: {
        in: [
          rateLimitBucketId("login", "ip", testIp),
          rateLimitBucketId("login", "account", "admin@example.com"),
        ],
      },
    },
  });
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": testIp },
    body: JSON.stringify({ email: "admin@example.com", password: "DemoPasswort123!" }),
  });
  assert.equal(login.status, 200, `Admin-Login fehlgeschlagen: ${login.status}`);
  const cookie = cookieHeader(login);

  const leadEmail = `operations-runtime-${Date.now()}@example.org`;
  const leadResponse = await fetch(`${baseUrl}/api/leads`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": testIp,
    },
    body: JSON.stringify({
      name: "Operations Runtime Test",
      companyName: "FLYERO Testbetrieb",
      email: leadEmail,
      phone: "+49 261 000000",
      city: "Koblenz",
      message: "Testanfrage fuer den Betriebs-E-Mail-Versand.",
      source: "operations-email-runtime",
    }),
  });
  const leadBody = await leadResponse.text();
  assert.equal(leadResponse.status, 201, `Lead-Anfrage fehlgeschlagen: ${leadResponse.status} ${leadBody}`);
  const leadResult = JSON.parse(leadBody);
  createdLeadId = leadResult.data.id;
  const leadQueues = await prisma.notificationQueue.findMany({
    where: { recipientEmail: "hallo@flyero.org", message: { type: "LEAD_CREATED" } },
    include: { message: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const leadQueue = leadQueues.find((item) => item.message.data && typeof item.message.data === "object" && item.message.data.leadId === leadResult.data.id);
  assert.ok(leadQueue, "Lead-Anfrage hat keine Betriebs-E-Mail-Queue erzeugt.");

  const message = await prisma.notificationMessage.create({
    data: {
      type: "OPERATIONS_EMAIL_RUNTIME",
      audience: "INTERNAL",
      channel: "IN_APP",
      subject: "Operations Runtime Test",
      body: "Vollständige Vorgangsdaten:\norderNumber: TEST-OPERATIONS-EMAIL",
      data: { source: "operations-email-runtime", orderNumber: "TEST-OPERATIONS-EMAIL" },
    },
  });
  const queue = await prisma.notificationQueue.create({
    data: {
      messageId: message.id,
      recipientEmail: "hallo@flyero.org",
      channel: "EMAIL",
      status: "PENDING",
      payload: { source: "operations-email-runtime", subject: message.subject, body: message.body, data: message.data },
    },
  });

  let processBody = "";
  let processed = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const process = await fetch(`${baseUrl}/api/admin/notifications/queue/process`, {
      method: "POST",
      headers: { cookie },
    });
    processBody = await process.text();
    assert.equal(process.status, 200, `Queue-Verarbeitung fehlgeschlagen: ${process.status} ${processBody}`);
    processed = await prisma.notificationQueue.findUnique({ where: { id: queue.id } });
    if (processed?.status === "SENT") break;
  }
  assert.ok(processed, `Test-Queue nicht gefunden. Worker-Antwort: ${processBody}`);
  assert.equal(processed?.recipientEmail, "hallo@flyero.org");
  assert.equal(processed?.status, "SENT", `Worker-Antwort: ${processBody}`);
  assert.match(processed?.providerMessageId || "", /^mock_/);
  console.log("Operations email runtime checks passed.");
} finally {
  await prisma.notificationQueue.deleteMany({ where: { recipientEmail: "hallo@flyero.org", payload: { path: ["source"], equals: "operations-email-runtime" } } });
  await prisma.notificationMessage.deleteMany({ where: { data: { path: ["source"], equals: "operations-email-runtime" } } });
  if (createdLeadId) {
    const leadMessages = await prisma.notificationMessage.findMany({
      where: { data: { path: ["leadId"], equals: createdLeadId } },
      select: { id: true },
    });
    const messageIds = leadMessages.map((message) => message.id);
    if (messageIds.length > 0) {
      await prisma.notificationQueue.deleteMany({ where: { messageId: { in: messageIds } } });
      await prisma.notificationMessage.deleteMany({ where: { id: { in: messageIds } } });
    }
    await prisma.lead.delete({ where: { id: createdLeadId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
  if (child) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    else child.kill();
  }
}
