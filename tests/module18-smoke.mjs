import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const TEST_PORT = process.env.BETA_PORT || process.env.PORT || "3018";
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
    env: { ...process.env, EMAIL_PROVIDER: "mock", PORT: TEST_PORT },
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
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    child.kill();
  }
  throw new Error("Dev-Server konnte fuer Modul 18 Smoke nicht gestartet werden.");
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

await includes("src/lib/email.ts", ["EMAIL_PROVIDER", "SMTP_HOST", "RESEND_API_KEY", "sendEmail"]);
await includes("src/lib/notificationWorker.ts", [
  "processPendingNotifications",
  "sendNotificationMessage",
  "retryFailedNotification",
  "MAX_PER_RUN",
  "MAX_ATTEMPTS",
]);
await includes("README.md", ["EMAIL_PROVIDER", "SMTP Setup", "Queue Worker", "Cron-Hinweis"]);
await includes("ARCHITECTURE_DECISIONS.md", ["Queue statt Direktversand", "Mock Provider", "Rate Limit"]);
await includes("package.json", ["test:module18"]);

for (const filePath of [
  "src/app/admin/notifications/queue/page.tsx",
  "src/app/api/admin/notifications/queue/route.ts",
  "src/app/api/admin/notifications/queue/process/route.ts",
  "src/app/api/admin/notifications/queue/[id]/retry/route.ts",
  "src/app/api/internal/notifications/process/route.ts",
  "src/app/api/admin/notifications/test-email/route.ts",
]) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
}

async function ensureModule18SeedStatus(status) {
  const existing = await prisma.notificationQueue.findFirst({
    where: { status, payload: { path: ["source"], equals: "seed.module18" } },
  });
  if (existing) return;

  const user = await prisma.user.findFirst({ where: { role: "CUSTOMER" } });
  assert(user, "Customer fuer Modul 18 Seed-Fixture fehlt.");
  const message = await prisma.notificationMessage.create({
    data: {
      userId: user.id,
      type: `MODULE18_SEED_${status}`,
      audience: "CUSTOMER",
      channel: "IN_APP",
      subject: `Module 18 Seed ${status}`,
      body: "Seed-Fixture fuer stabile Queue-Statuspruefung.",
      data: { source: "seed.module18" },
    },
  });
  await prisma.notificationQueue.create({
    data: {
      messageId: message.id,
      userId: user.id,
      channel: "EMAIL",
      status,
      attempts: status === "FAILED" ? 3 : status === "RETRY" ? 1 : 0,
      maxAttempts: 3,
      sentAt: status === "SENT" ? new Date() : null,
      failedAt: status === "FAILED" || status === "RETRY" ? new Date() : null,
      lastError: status === "FAILED" || status === "RETRY" ? "Smoke-Fixture" : null,
      payload: { subject: `Module 18 Seed ${status}`, body: "Seed-Fixture", source: "seed.module18" },
    },
  });
}

for (const status of ["PENDING", "SENT", "FAILED", "RETRY"]) {
  await ensureModule18SeedStatus(status);
}

const seedStatuses = await prisma.notificationQueue.groupBy({
  by: ["status"],
  _count: { status: true },
  where: { payload: { path: ["source"], equals: "seed.module18" } },
});
for (const status of ["PENDING", "SENT", "FAILED", "RETRY"]) {
  assert(seedStatuses.some((item) => item.status === status), `Seed Queue Status ${status} fehlt.`);
}

const server = await ensureServer();
try {
  const adminCookie = await loginAdmin();
  const queuePage = await fetchLocal("/admin/notifications/queue", { headers: { cookie: adminCookie } });
  assert(queuePage.status === 200, `/admin/notifications/queue lieferte ${queuePage.status}`);

  const queueResponse = await jsonRequest("/api/admin/notifications/queue", { cookie: adminCookie });
  const queueText = JSON.stringify(queueResponse);
  assert(!queueText.includes(process.env.SMTP_PASS || "__never__"), "SMTP_PASS wurde geleakt.");
  assert(!queueText.includes(process.env.RESEND_API_KEY || "__never__"), "RESEND_API_KEY wurde geleakt.");

  const user = await prisma.user.findFirst({ where: { role: "CUSTOMER" } });
  assert(user, "Customer fuer Modul 18 Smoke fehlt.");
  const template = await prisma.notificationTemplate.findFirst({ where: { channel: "EMAIL" } });

  async function createQueue(status = "PENDING", attempts = 0) {
    const message = await prisma.notificationMessage.create({
      data: {
        userId: user.id,
        templateId: template?.id,
        type: "MODULE18_SMOKE",
        audience: "CUSTOMER",
        channel: "IN_APP",
        subject: `Module 18 Smoke ${Date.now()}`,
        body: "Smoke Test Mail",
        data: { source: "module18-smoke" },
      },
    });
    return prisma.notificationQueue.create({
      data: {
        messageId: message.id,
        templateId: template?.id,
        userId: user.id,
        channel: "EMAIL",
        status,
        attempts,
        maxAttempts: 3,
        failedAt: status === "FAILED" || status === "RETRY" ? new Date() : null,
        lastError: status === "FAILED" || status === "RETRY" ? "Smoke Fehler" : null,
        payload: { subject: message.subject, body: message.body, source: "module18-smoke" },
      },
    });
  }

  await prisma.notificationQueue.updateMany({
    where: {
      channel: "EMAIL",
      status: { in: ["PENDING", "RETRY"] },
    },
    data: { scheduledAt: new Date(Date.now() + 60 * 60 * 1000) },
  });

  const pending = await createQueue("PENDING", 0);
  const processed = await jsonRequest("/api/admin/notifications/queue/process", {
    method: "POST",
    cookie: adminCookie,
  });
  assert(processed.data.processed >= 1, "Queue Worker hat keine PENDING Mail verarbeitet.");
  const sentPending = await prisma.notificationQueue.findUnique({ where: { id: pending.id } });
  assert(sentPending.status === "SENT", "Mock Provider hat PENDING Queue nicht gesendet.");
  assert(sentPending.providerMessageId?.startsWith("mock_"), "Mock Provider Message-ID fehlt.");

  const failed = await createQueue("FAILED", 1);
  const retried = await jsonRequest(`/api/admin/notifications/queue/${failed.id}/retry`, {
    method: "POST",
    cookie: adminCookie,
  });
  assert(retried.data.status === "SENT", "FAILED Queue konnte nicht per Retry gesendet werden.");

  const exhausted = await createQueue("PENDING", 3);
  await jsonRequest("/api/admin/notifications/queue/process", { method: "POST", cookie: adminCookie });
  const exhaustedAfter = await prisma.notificationQueue.findUnique({ where: { id: exhausted.id } });
  assert(exhaustedAfter.status === "FAILED", "Max Retry wurde nicht respektiert.");
  assert(exhaustedAfter.attempts === 3, "Attempts wurden ueber 3 erhoeht.");

  const testMail = await jsonRequest("/api/admin/notifications/test-email", {
    method: "POST",
    cookie: adminCookie,
    expected: [201],
    body: {
      recipient: "module18@example.com",
      subject: "Module 18 Testmail",
      text: "Hallo aus dem Smoke-Test.",
    },
  });
  assert(testMail.data.provider === "mock", "Testmail nutzt nicht den Mock Provider.");

  const [auditCount, systemLogCount, backgroundCount, emailLogCount] = await Promise.all([
    prisma.auditLog.count({ where: { action: { in: ["email.sent", "email.failed", "email.retry", "email.test_sent", "notification.queue_processed"] } } }),
    prisma.systemLog.count({ where: { source: { in: ["email.mock", "email.queue", "email.test"] } } }),
    prisma.backgroundJobLog.count({ where: { jobType: "NOTIFICATION_QUEUE" } }),
    prisma.notificationLog.count({ where: { action: { in: ["email.sent", "email.failed", "email.retry", "email.test_sent", "notification.queue_processed"] } } }),
  ]);
  assert(auditCount >= 4, "E-Mail AuditLogs fehlen.");
  assert(systemLogCount >= 2, "E-Mail SystemLogs fehlen.");
  assert(backgroundCount >= 1, "Notification Queue BackgroundJobLog fehlt.");
  assert(emailLogCount >= 4, "E-Mail NotificationLogs fehlen.");

  console.log("Module 18 email queue smoke checks passed.");
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
