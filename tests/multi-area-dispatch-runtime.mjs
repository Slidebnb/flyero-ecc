import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const baseUrl = process.env.MODULE27_1_BASE_URL || "http://127.0.0.1:3000";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function cookies(response) {
  return (response.headers.get("set-cookie") || "").split(/,(?=[^;,]+=)/).map((part) => part.split(";")[0]).join("; ");
}

async function login(email, ip) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email, password: "DemoPasswort123!" }),
  });
  assert.equal(response.status, 200, `Admin-Login fehlgeschlagen: ${await response.text()}`);
  return cookies(response);
}

async function postForm(path, form, cookie) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", cookie },
    body: new URLSearchParams(form),
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  assert.ok(response.ok, `${path}: ${response.status} ${text}`);
  return data;
}

const suffix = randomUUID().slice(0, 8);
const orderNumber = `TEST-MODULE27-DISPATCH-${suffix}`;
let orderId;

try {
  const customer = await prisma.customerProfile.findFirst({ where: { user: { email: "kunde.immobilien@example.com" } } });
  const warehouse = await prisma.warehouse.findFirst({ include: { locations: true } });
  const distributors = await prisma.distributorProfile.findMany({
    where: { reviewStatus: "APPROVED", user: { status: "ACTIVE" } },
    orderBy: { id: "asc" },
    take: 2,
  });
  assert.ok(customer?.tenantId, "Testkunde oder Tenant fehlt.");
  assert.ok(warehouse?.locations[0], "Testlager oder Lagerort fehlt.");
  assert.equal(distributors.length, 2, "Mindestens zwei aktive Verteiler werden für Mehrgebiets-Dispatch benötigt.");

  const now = new Date();
  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId: customer.id,
      tenantId: customer.tenantId,
      status: "APPROVED",
      city: "Koblenz",
      postalCode: "56068",
      targetAddress: { city: "Koblenz", postalCode: "56068", country: "DE" },
      targetAreaName: "Test Mehrgebiets-Dispatch",
      targetAreaGeoJson: { type: "FeatureCollection", features: [] },
      estimatedHouseholds: 2000,
      estimatedFlyers: 8000,
      coverageAreaSqm: 1200000,
      flyerQuantity: 8000,
      customerOwnFlyers: true,
      needsPrintService: false,
      preferredStartDate: new Date(now.getTime() + 8 * 86400000),
      preferredEndDate: new Date(now.getTime() + 15 * 86400000),
      calculatedNetPrice: 3040,
      calculatedVat: 577.6,
      calculatedGrossPrice: 3617.6,
      priceRuleSnapshot: { pricingVersion: "module27-dispatch-test", areaCalculationSnapshot: { polygonHash: "test-dispatch" } },
      distributionSegments: {
        create: [
          { name: "Koblenz Segment", city: "Koblenz", postalCode: "56068", country: "DE", geometryGeoJson: { type: "FeatureCollection", features: [] }, areaSqm: 600000, flyerQuantity: 1200, sortOrder: 0 },
          { name: "Bendorf Segment", city: "Bendorf", postalCode: "56170", country: "DE", geometryGeoJson: { type: "FeatureCollection", features: [] }, areaSqm: 600000, flyerQuantity: 6800, sortOrder: 1 },
        ],
      },
      warehouseInventory: {
        create: {
          warehouseId: warehouse.id,
          warehouseLocationId: warehouse.locations[0].id,
          status: "READY_FOR_PICKUP",
          pickupStatus: "PREPARED",
          qrCode: `TEST-QR-${suffix}`,
          pickupToken: `TEST-PICKUP-${suffix}`,
          expectedFlyers: 8000,
          receivedFlyers: 8000,
          remainingFlyers: 8000,
        },
      },
    },
    include: { distributionSegments: true, warehouseInventory: true },
  });
  orderId = order.id;
  const [segmentA, segmentB] = order.distributionSegments;
  const cookie = await login("admin@example.com", "198.51.100.77");

  const recommendationsA = await postForm(`/api/admin/dispatch/recommend/${order.id}`, { segmentId: segmentA.id }, cookie);
  assert.ok(recommendationsA?.data?.length, "Für Segment A wurden keine Empfehlungen erstellt.");
  const storedA = await prisma.autoDispatchRecommendation.findMany({ where: { orderId: order.id, segmentId: segmentA.id } });
  const storedB = await prisma.autoDispatchRecommendation.findMany({ where: { orderId: order.id, segmentId: segmentB.id } });
  assert.ok(storedA.length > 0, "Segment A wurde nicht separat gespeichert.");
  assert.equal(storedB.length, 0, "Empfehlungen für Segment A dürfen Segment B nicht verändern.");

  const firstDistributor = storedA[0].distributorId;
  const assignedA = await postForm(`/api/admin/orders/${order.id}/assign`, { distributorId: firstDistributor, segmentId: segmentA.id, returnTo: "/admin/dispatch" }, cookie);
  assert.ok(assignedA?.data?.id, "Segment A wurde nicht zugewiesen.");

  const recommendationsB = await postForm(`/api/admin/dispatch/recommend/${order.id}`, { segmentId: segmentB.id }, cookie);
  assert.ok(recommendationsB?.data?.length, "Für Segment B wurden keine Empfehlungen erstellt.");
  const secondRecommendation = await prisma.autoDispatchRecommendation.findFirst({ where: { orderId: order.id, segmentId: segmentB.id, distributorId: { not: firstDistributor } } });
  assert.ok(secondRecommendation, "Segment B konnte keinen unabhängigen Verteiler empfehlen.");
  await postForm(`/api/admin/orders/${order.id}/assign`, { distributorId: firstDistributor, segmentId: segmentB.id, returnTo: "/admin/dispatch" }, cookie);

  const assignments = await prisma.dispatchAssignment.findMany({ where: { orderId: order.id, status: { in: ["ASSIGNED", "ACCEPTED"] } } });
  assert.deepEqual(assignments.map((item) => item.segmentId).sort(), [segmentA.id, segmentB.id].sort(), "Mehrgebiets-Zuweisungen sind nicht getrennt gespeichert.");
  const tours = await prisma.distributionTour.findMany({ where: { orderId: order.id, status: "ASSIGNED" } });
  assert.deepEqual(tours.map((item) => item.segmentId).sort(), [segmentA.id, segmentB.id].sort(), "Mehrgebiets-Touren sind nicht getrennt gespeichert.");

  const firstDistributorProfile = await prisma.distributorProfile.findUnique({ where: { id: firstDistributor }, include: { user: { select: { email: true } } } });
  assert.ok(firstDistributorProfile?.user.email, "Der zugewiesene Verteiler hat kein Benutzerkonto.");
  const distributorCookie = await login(firstDistributorProfile.user.email, "198.51.100.78");
  const assignmentB = assignments.find((item) => item.segmentId === segmentB.id);
  assert.ok(assignmentB, "Segment B Assignment fehlt vor der Annahme.");
  const acceptedB = await postForm(`/api/distributor/orders/${order.id}/accept`, { assignmentId: assignmentB.id }, distributorCookie);
  assert.equal(acceptedB?.data?.id, assignmentB.id, "Die Verteilerannahme hat nicht das ausgewählte Teilgebiet verwendet.");
  const afterAccept = await prisma.dispatchAssignment.findMany({ where: { orderId: order.id }, select: { id: true, segmentId: true, status: true } });
  assert.equal(afterAccept.find((item) => item.id === assignmentB.id)?.status, "ACCEPTED", "Segment B wurde nicht angenommen.");
  assert.equal(afterAccept.find((item) => item.segmentId === segmentA.id)?.status, "ASSIGNED", "Die Annahme von Segment B darf Segment A nicht verÃ¤ndern.");

  console.log(`Module 27.1 multi-area dispatch runtime passed: order=${order.orderNumber}, segmentFlyers=1200+6800, selected-assignment-acceptance=ok`);
} finally {
  if (orderId) await prisma.order.delete({ where: { id: orderId } }).catch(() => undefined);
  await prisma.$disconnect();
}
