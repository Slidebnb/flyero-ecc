import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const schema = await readFile("prisma/schema.prisma", "utf8");
const auth = await readFile("src/lib/auth.ts", "utf8");
const tenant = await readFile("src/lib/tenant.ts", "utf8");
const customerOrders = await readFile("src/app/api/customer/orders/route.ts", "utf8");
const customerReports = await readFile("src/app/api/customer/reports/route.ts", "utf8");
const customerInvoices = await readFile("src/app/api/customer/invoices/route.ts", "utf8");
const customerPayments = await readFile("src/app/api/customer/payments/route.ts", "utf8");
const customerOrderDetail = await readFile("src/app/api/customer/orders/[id]/route.ts", "utf8");
const customerReportDownload = await readFile("src/app/api/customer/reports/[id]/download/route.ts", "utf8");
const customerDocumentDownload = await readFile("src/app/api/customer/documents/[id]/download/route.ts", "utf8");
const customerAreas = await readFile("src/app/api/areas/route.ts", "utf8");
const areaManagement = await readFile("src/app/api/areas/[id]/route.ts", "utf8");
const areaLibrary = await readFile("src/lib/areas.ts", "utf8");
const areaPage = await readFile("src/app/admin/areas/page.tsx", "utf8");
const customerSupport = await readFile("src/lib/support.ts", "utf8");

assert.match(schema, /model Tenant\s*\{/);
assert.match(schema, /model TenantMembership\s*\{/);
assert.match(schema, /tenantId\s+String\??/);
for (const field of ["tenantId"]) assert.match(auth, new RegExp(field));
assert.match(tenant, /tenantMembership/);
for (const route of [customerOrders, customerReports, customerInvoices, customerPayments]) {
  assert.match(route, /requireTenantSession|tenantId/, "Customer-API muss serverseitig Tenant-scope pruefen.");
}
for (const route of [customerOrderDetail, customerReportDownload, customerDocumentDownload]) {
  assert.match(route, /requireTenantSession/, "Einzel-/Download-Route muss Tenant-Sessions erzwingen.");
}
assert.match(customerOrderDetail, /tenantId/);
assert.match(customerReportDownload, /tenantId/);
assert.match(customerDocumentDownload, /getDocumentDownload\(session/);
assert.match(customerAreas, /tenantId/);
assert.match(customerAreas, /requireActiveTenantMembership/);
assert.match(areaManagement, /requireActiveTenantMembership/);
assert.match(areaManagement, /tenantId: session\.role === UserRole\.ADMIN \? undefined : session\.tenantId/);
assert.match(areaLibrary, /tenantId === undefined/);
assert.match(areaPage, /listAreas/);
assert.match(areaPage, /session\.role === UserRole\.ADMIN \? undefined : session\.tenantId/);
assert.match(customerSupport, /tenantId/);

try {
  const customers = await prisma.customerProfile.findMany({
    select: { id: true, tenantId: true, user: { select: { id: true, tenantId: true } } },
  });
  assert.ok(customers.length >= 2, "Tenant-Smoke braucht mindestens zwei Seed-Kunden.");
  assert.equal(new Set(customers.map((customer) => customer.tenantId)).size, customers.length, "Kunden müssen getrennte Tenants besitzen.");
  for (const customer of customers) {
    assert.equal(customer.user.tenantId, customer.tenantId, "User und CustomerProfile müssen denselben Tenant besitzen.");
    const membership = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: customer.tenantId, userId: customer.user.id } },
      select: { status: true, role: true },
    });
    assert.equal(membership?.status, "ACTIVE");
    assert.equal(membership?.role, "OWNER");
  }

  const orders = await prisma.order.findMany({
    where: { customerId: { in: customers.map((customer) => customer.id) } },
    select: { tenantId: true, customer: { select: { tenantId: true } } },
    take: 20,
  });
  for (const order of orders) assert.equal(order.tenantId, order.customer.tenantId, "Order darf nicht tenant-fremd verknüpft sein.");

  const customerIds = customers.map((customer) => customer.id);
  const [areas, tickets, experienceEvents] = await Promise.all([
    prisma.distributionArea.findMany({ where: { customerId: { in: customerIds } }, select: { tenantId: true, customer: { select: { tenantId: true } } } }),
    prisma.supportTicket.findMany({ where: { customerId: { in: customerIds } }, select: { tenantId: true, customer: { select: { tenantId: true } } } }),
    prisma.orderExperienceEvent.findMany({ where: { customerId: { in: customerIds } }, select: { tenantId: true, customer: { select: { tenantId: true } } } }),
  ]);
  for (const record of [...areas, ...tickets, ...experienceEvents]) {
    assert.ok(record.tenantId, "Kundenbezogene Nebenressource darf keinen fehlenden Tenant besitzen.");
    assert.equal(record.tenantId, record.customer?.tenantId, "Kundenbezogene Nebenressource darf nicht tenant-fremd verknüpft sein.");
  }
} finally {
  await prisma.$disconnect();
}

console.log("Tenant foundation smoke passed.");
