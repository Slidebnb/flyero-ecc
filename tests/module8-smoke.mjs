import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function includes(path, snippets) {
  assert(existsSync(path), `${path} fehlt.`);
  const content = await readFile(path, "utf8");
  for (const snippet of snippets) {
    assert(content.includes(snippet), `${path} enthaelt nicht: ${snippet}`);
  }
}

await includes("prisma/schema.prisma", [
  "DistributionArea",
  "AreaPolygon",
  "AreaHouseholdEstimate",
  "AreaHistory",
  "DistributionAreaType",
  "estimatedFlyers",
  "estimatedDistanceMeters",
  "coverageAreaSqm",
]);

await includes("src/app/components/DistributionAreaEditor.tsx", [
  "DrawingManager",
  "POLYGON",
  "setEditable",
  "setDraggable",
  "Polygon löschen",
  "Auto Zoom",
  "Kartenbearbeitung derzeit nicht verfügbar",
  "Gebiete können weiterhin gespeichert werden",
]);

await includes("src/lib/areas.ts", [
  "normalizeAreaGeoJson",
  "createDistributionArea",
  "updateDistributionArea",
  "deleteDistributionArea",
  "copyDistributionArea",
  "assignAreaToOrder",
  "area.created",
  "area.updated",
  "area.deleted",
  "area.reference_linked",
]);

for (const path of [
  "src/app/admin/areas/page.tsx",
  "src/app/api/areas/route.ts",
  "src/app/api/areas/[id]/route.ts",
  "src/app/api/orders/[id]/area/route.ts",
  "src/app/customer/orders/new/page.tsx",
  "src/app/customer/orders/[id]/page.tsx",
]) {
  assert(existsSync(path), `${path} fehlt.`);
}

await includes("README.md", ["Modul 8", "/admin/areas", "/api/areas", "DistributionAreaEditor"]);
await includes("ARCHITECTURE_DECISIONS.md", ["DistributionArea", "GeoJSON", "Haushaltsberechnung"]);

const [
  areaCount,
  polygonCount,
  postalCodeCount,
  districtCount,
  radiusCount,
  estimateCount,
  assignedOrders,
  areaCreatedAudit,
  areaAssignedHistory,
] = await Promise.all([
  prisma.distributionArea.count({ where: { status: "ACTIVE" } }),
  prisma.areaPolygon.count(),
  prisma.distributionArea.count({ where: { type: "POSTAL_CODE" } }),
  prisma.distributionArea.count({ where: { type: "DISTRICT" } }),
  prisma.distributionArea.count({ where: { type: "RADIUS" } }),
  prisma.areaHouseholdEstimate.count(),
  prisma.order.count({ where: { distributionAreaId: { not: null } } }),
  prisma.auditLog.count({ where: { action: { in: ["area.created", "area.updated", "area.deleted", "area.reference_linked"] } } }),
  prisma.areaHistory.count({ where: { action: "area.reference_linked" } }),
]);

assert(areaCount >= 20, "Seed enthaelt weniger als 20 aktive Gebiete.");
assert(polygonCount >= 8, "Es fehlen Polygon-Geometrien.");
assert(postalCodeCount >= 2, "PLZ-Gebiete fehlen.");
assert(districtCount >= 6, "Ortsteil-Gebiete fehlen.");
assert(radiusCount >= 3, "Radius-Gebiete fehlen.");
assert(estimateCount >= 20, "Haushaltsschaetzungen fehlen.");
assert(assignedOrders >= 10, "Auftrags-Zuweisungen zu Gebieten fehlen.");
assert(areaCreatedAudit >= 2, "Area-AuditLogs fehlen.");
assert(areaAssignedHistory >= 5, "AreaHistory fuer Zuweisungen fehlt.");

const geoJsonArea = await prisma.distributionArea.findFirst({
  where: { type: "POLYGON" },
  include: { polygons: true, estimates: true },
});
assert(geoJsonArea, "Polygon-Gebiet mit GeoJSON fehlt.");
assert(geoJsonArea.polygons.length >= 1, "Polygon-Gebiet hat keine AreaPolygon-Zeile.");
assert(geoJsonArea.estimates.length >= 1, "Polygon-Gebiet hat keine Haushaltsberechnung.");

await prisma.$disconnect();
console.log("Module 8 smoke checks passed.");
