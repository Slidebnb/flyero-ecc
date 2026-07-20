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

function segmentGeometry(left, bottom) {
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[[left, bottom], [left + 0.01, bottom], [left + 0.01, bottom + 0.01], [left, bottom + 0.01], [left, bottom]]] },
    }],
  };
}

function geometryAreaSqm(geometry) {
  const ring = geometry.features[0].geometry.coordinates[0];
  const metersPerDegree = 111320;
  const averageLatitude = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
  const metersPerLongitudeDegree = Math.cos((averageLatitude * Math.PI) / 180) * metersPerDegree;
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    area += current[0] * metersPerLongitudeDegree * (next[1] * metersPerDegree) - next[0] * metersPerLongitudeDegree * (current[1] * metersPerDegree);
  }
  return Math.round(Math.abs(area / 2));
}

function geometryPerimeterMeters(geometry) {
  const metersPerDegree = 111320;
  return Math.round(geometry.features.reduce((featureTotal, feature) => {
    const ring = feature.geometry.coordinates[0];
    return featureTotal + ring.slice(1).reduce((sum, point, index) => {
      const previous = ring[index];
      const latitude = ((point[1] + previous[1]) / 2) * Math.PI / 180;
      const dx = (point[0] - previous[0]) * Math.cos(latitude) * metersPerDegree;
      const dy = (point[1] - previous[1]) * metersPerDegree;
      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0);
  }, 0));
}

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
  const preferredStartDate = new Date(now.getTime() + 8 * 86400000);
  const preferredEndDate = new Date(now.getTime() + 15 * 86400000);
  const geometryA = segmentGeometry(7.58, 50.35);
  const geometryB = segmentGeometry(7.61, 50.354);
  const targetAreaGeoJson = { type: "FeatureCollection", features: [...geometryA.features, ...geometryB.features] };
  const coverageAreaSqm = geometryAreaSqm(geometryA) + geometryAreaSqm(geometryB);
  const quoteResponse = await fetch(`${baseUrl}/api/public/planner/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      city: "Koblenz",
      postalCode: "56068",
      flyerQuantity: 8000,
      coverageAreaSqm,
      flyerSource: "CUSTOMER_OWN",
      printDataStatus: "UPLOAD_LATER",
      preferredStartDate: preferredStartDate.toISOString(),
      preferredEndDate: preferredEndDate.toISOString(),
      segments: [
        { name: "Koblenz Segment", city: "Koblenz", postalCode: "56068", geometryGeoJson: geometryA, flyerQuantity: 1200 },
        { name: "Bendorf Segment", city: "Bendorf", postalCode: "56170", geometryGeoJson: geometryB, flyerQuantity: 6800 },
      ],
    }),
  });
  const quotePayload = await quoteResponse.json();
  assert.equal(quoteResponse.status, 200, `Gebietsquote fuer Dispatch-Test fehlgeschlagen: ${JSON.stringify(quotePayload)}`);
  const quote = quotePayload.data.quote;
  const quoteMetrics = quotePayload.data.metrics;
  const quoteInput = {
    flyerQuantity: 8000,
    polygonHash: quote.polygonHash,
    city: "Koblenz",
    postalCode: "56068",
    street: "",
    houseNumber: "",
    coverageAreaSqm,
    flyerSource: "CUSTOMER_OWN",
    printDataStatus: "UPLOAD_LATER",
    productFormat: "DIN Lang (99 x 210 mm)",
    pricingRuleSignature: quote.pricingRuleSignature,
    preferredStartDate: preferredStartDate.toISOString(),
    preferredEndDate: preferredEndDate.toISOString(),
    perimeterMeters: geometryPerimeterMeters(targetAreaGeoJson),
  };
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
      targetAreaGeoJson,
      estimatedHouseholds: 2000,
      estimatedFlyers: 8000,
      coverageAreaSqm,
      flyerQuantity: 8000,
      customerOwnFlyers: true,
      needsPrintService: false,
      preferredStartDate,
      preferredEndDate,
      calculatedNetPrice: quote.net,
      calculatedVat: quote.vat,
      calculatedGrossPrice: quote.gross,
      areaDifficulty: quoteMetrics.areaDifficulty,
      priceRuleSnapshot: {
        pricingVersion: quote.pricingVersion,
        areaDifficulty: quoteMetrics.areaDifficulty,
        areaDifficultyFactor: quoteMetrics.areaDifficultyFactor,
        productFormat: "DIN Lang (99 x 210 mm)",
        printDataStatus: "UPLOAD_LATER",
        areaCalculationSnapshot: {
          quote: {
            ...quoteInput,
            input: quoteInput,
            fingerprint: quote.fingerprint,
            netPrice: quote.net,
            vatAmount: quote.vat,
            grossPrice: quote.gross,
            quoteConfidence: quote.confidenceByMetric,
          },
          polygonHash: quote.polygonHash,
          quoteFingerprint: quote.fingerprint,
          coverageAreaSqm,
        },
      },
      distributionSegments: {
        create: [
          { name: "Koblenz Segment", city: "Koblenz", postalCode: "56068", country: "DE", geometryGeoJson: geometryA, areaSqm: geometryAreaSqm(geometryA), flyerQuantity: 1200, sortOrder: 0 },
          { name: "Bendorf Segment", city: "Bendorf", postalCode: "56170", country: "DE", geometryGeoJson: geometryB, areaSqm: geometryAreaSqm(geometryB), flyerQuantity: 6800, sortOrder: 1 },
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
  const tamperedTargetAreaGeoJson = {
    ...targetAreaGeoJson,
    features: targetAreaGeoJson.features.map((feature, index) => index === 0
      ? {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: [feature.geometry.coordinates[0].map(([longitude, latitude]) => [longitude + 0.001, latitude])],
          },
        }
      : feature),
  };
  await prisma.order.update({ where: { id: order.id }, data: { targetAreaGeoJson: tamperedTargetAreaGeoJson } });
  const tamperedAssignment = await fetch(`${baseUrl}/api/admin/orders/${order.id}/assign`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", cookie },
    body: new URLSearchParams({ distributorId: firstDistributor, segmentId: segmentA.id }),
  });
  assert.equal(tamperedAssignment.status, 409, "Eine manipulierte Gebietsreferenz darf keine Dispatch-Zuweisung erlauben.");
  const tamperedPayload = await tamperedAssignment.json();
  assert.equal(tamperedPayload.code, "ORDER_INTEGRITY_FAILED", "Dispatch-Integritaetsfehler muss fachlich codiert sein.");
  await prisma.order.update({ where: { id: order.id }, data: { targetAreaGeoJson } });
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
