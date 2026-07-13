import assert from "node:assert/strict";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const baseUrl = process.env.AREA_SCOPE_BASE_URL || "http://localhost:3000";
const password = "DemoPasswort123!";
const ip = `198.51.100.${Date.now() % 200 + 20}`;

function cookieHeaderFrom(response) {
  return (response.headers.get("set-cookie") || "")
    .split(/,(?=[^;,]+=)/)
    .map((item) => item.split(";")[0])
    .join("; ");
}

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email: "support@example.com", password }),
  });
  assert.equal(response.status, 200, `Support-Login fehlgeschlagen: ${response.status}`);
  return cookieHeaderFrom(response);
}

let supportCookie = "";
try {
  const support = await prisma.user.findUnique({
    where: { email: "support@example.com" },
    select: { id: true, tenantId: true, role: true },
  });
  assert.equal(support?.role, "SUPPORT_DISPATCHER", "Support-Demoaccount fehlt.");
  assert.ok(support.tenantId, "Support-Demoaccount braucht einen Tenant.");

  const foreignArea = await prisma.distributionArea.findFirst({
    where: { tenantId: { not: support.tenantId }, customerId: { not: null }, status: { not: "DELETED" } },
    select: { id: true, tenantId: true },
  });
  assert.ok(foreignArea, "Smoke braucht ein kundengebundenes Gebiet eines fremden Tenants.");

  supportCookie = await login();
  const listResponse = await fetch(`${baseUrl}/api/areas`, { headers: { cookie: supportCookie } });
  assert.equal(listResponse.status, 200, `Support-Gebietsliste fehlgeschlagen: ${listResponse.status}`);
  const listBody = await listResponse.json();
  assert.ok(Array.isArray(listBody.data), "Gebietsliste fehlt.");
  assert.ok(
    listBody.data.every((area) => area.tenantId === null || area.tenantId === support.tenantId),
    "Support darf keine kundengebundenen Gebiete anderer Tenants sehen.",
  );

  const deleteResponse = await fetch(`${baseUrl}/api/areas/${foreignArea.id}`, {
    method: "DELETE",
    headers: { cookie: supportCookie },
  });
  assert.equal(deleteResponse.status, 404, "Support darf fremde Gebiete nicht deaktivieren.");
  console.log("Area tenant scope smoke passed.");
} finally {
  await prisma.$disconnect();
}
