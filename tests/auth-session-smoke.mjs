import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let baseUrl = process.env.AUTH_SESSION_BASE_URL || "http://localhost:3000";
const email = "kunde.immobilien@example.com";
const password = "DemoPasswort123!";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 7000);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timer);
  }
}

async function ensureServer() {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/health`, { timeoutMs: 2500 });
    if (response.status < 500) return null;
  } catch {}

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
  throw new Error("Dev-Server konnte fuer Auth-Session-Smoke nicht gestartet werden.");
}

function cookieHeaderFrom(response) {
  return (response.headers.get("set-cookie") || "")
    .split(/,(?=[^;,]+=)/)
    .map((item) => item.split(";")[0])
    .join("; ");
}

async function login() {
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.text();
  assert(response.status === 200, `Login fehlgeschlagen: ${response.status} ${body}`);
  return cookieHeaderFrom(response);
}

async function me(cookie) {
  return fetchWithTimeout(`${baseUrl}/api/auth/me`, { headers: { cookie } });
}

const server = await ensureServer();
let originalStatus = null;
let originalRole = null;
let userId = null;
try {
  assert(prisma.authSession, "Prisma AuthSession-Modell fehlt.");

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, status: true } });
  assert(user, "Demo-Kunde fuer Auth-Session-Smoke fehlt.");
  userId = user.id;
  originalStatus = user.status;
  originalRole = user.role;

  const cookie = await login();
  const activeResponse = await me(cookie);
  const activeBody = await activeResponse.json();
  assert(activeResponse.status === 200, "Aktive Session wird nicht akzeptiert.");
  assert(activeBody.data.role === originalRole, "Aktive Session liefert nicht die aktuelle Rolle.");

  await prisma.user.update({ where: { id: userId }, data: { role: "SUPPORT_DISPATCHER" } });
  const changedRoleResponse = await me(cookie);
  const changedRoleBody = await changedRoleResponse.json();
  assert(changedRoleResponse.status === 200, "Session mit geänderter DB-Rolle wird abgelehnt.");
  assert(changedRoleBody.data.role === "SUPPORT_DISPATCHER", "DB-Rolle überschreibt die alte JWT-Rolle nicht.");
  await prisma.user.update({ where: { id: userId }, data: { role: originalRole } });

  const session = await prisma.authSession.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  assert(session, "Login legt keine AuthSession an.");
  await prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  assert((await me(cookie)).status === 401, "Widerrufene Session bleibt akzeptiert.");

  const freshCookie = await login();
  await prisma.user.update({ where: { id: userId }, data: { status: "DISABLED" } });
  assert((await me(freshCookie)).status === 401, "Deaktivierter Benutzer bleibt in bestehender Session autorisiert.");

  console.log("Auth-Session Smoke-Test erfolgreich abgeschlossen.");
} finally {
  if (userId && originalStatus) {
    await prisma.user.update({ where: { id: userId }, data: { role: originalRole, status: originalStatus } });
    await prisma.authSession.deleteMany({ where: { userId } });
  }
  await prisma.$disconnect();
  if (server) server.kill();
}
