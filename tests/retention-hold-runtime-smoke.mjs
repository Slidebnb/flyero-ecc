import assert from "node:assert/strict";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const baseUrl = process.env.RETENTION_HOLD_BASE_URL || "http://localhost:3000";
const password = "DemoPasswort123!";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function cookieHeader(response) {
  return (response.headers.get("set-cookie") || "")
    .split(/,(?=[^;,]+=)/)
    .map((item) => item.split(";")[0])
    .join("; ");
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "x-forwarded-for": "198.51.100.251",
      ...(options.headers || {}),
    },
  });
}

async function jsonResponse(response) {
  const text = await response.text();
  return { text, body: text ? JSON.parse(text) : {} };
}

let createdHoldId = null;
try {
  const order = await prisma.order.findFirst({
    select: { id: true, tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  assert(order, "Retention-Hold-Smoke braucht einen Auftrag.");

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password }),
  });
  assert.equal(login.status, 200, `Admin-Login fehlgeschlagen: ${login.status}`);
  const cookie = cookieHeader(login);
  assert(cookie, "Admin-Login liefert kein Session-Cookie.");

  const created = await request("/api/admin/retention-holds", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      orderId: order.id,
      reason: "Runtime smoke: voruebergehende Beweissicherung",
      caseReference: "SMOKE-RETENTION-001",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }),
  });
  const createdResponse = await jsonResponse(created);
  assert.equal(created.status, 201, `Hold-Erstellung fehlgeschlagen: ${created.status}: ${createdResponse.text}`);
  const createdBody = createdResponse.body;
  assert.equal(createdBody.data.tenantId, order.tenantId, "Hold uebernimmt nicht den Tenant des Auftrags.");
  createdHoldId = createdBody.data.id;

  const listed = await request(`/api/admin/retention-holds?orderId=${order.id}`, { headers: { cookie } });
  const listedResponse = await jsonResponse(listed);
  assert.equal(listed.status, 200, `Hold-Liste ist nicht erreichbar: ${listed.status}: ${listedResponse.text}`);
  const listedBody = listedResponse.body;
  assert(listedBody.data.some((hold) => hold.id === createdHoldId), "Erstellter Hold fehlt in der Liste.");

  const released = await request(`/api/admin/retention-holds/${createdHoldId}`, {
    method: "PATCH",
    headers: { cookie },
  });
  const releasedResponse = await jsonResponse(released);
  assert.equal(released.status, 200, `Hold-Aufhebung fehlgeschlagen: ${released.status}: ${releasedResponse.text}`);
  const releasedBody = releasedResponse.body;
  assert(releasedBody.data.releasedAt, "Hold wurde nicht als aufgehoben markiert.");

  console.log("Retention-Hold-Runtime-Smoke erfolgreich abgeschlossen.");
} finally {
  if (createdHoldId) await prisma.retentionHold.delete({ where: { id: createdHoldId } }).catch(() => {});
  await prisma.$disconnect();
}
