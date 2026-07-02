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
  "inventoryId",
  "pickupTime",
  "totalPauseSeconds",
  "totalDistanceMeters",
  "UNDER_REVIEW",
  "altitude",
  "battery",
  "source",
  "flags",
]);

await includes("src/lib/tours.ts", [
  "confirmPickup",
  "startTour",
  "pauseTour",
  "resumeTour",
  "uploadGpsPoints",
  "uploadTourPhoto",
  "completeTour",
  "tour.assigned",
  "gps.uploaded",
  "photo.uploaded",
]);

await includes("src/app/distributor/tours/[id]/TourClient.tsx", [
  "localStorage",
  "navigator.geolocation",
  "getUserMedia",
  "capture=\"environment\"",
  "flushBufferedPoints",
]);

for (const path of [
  "src/app/api/distributor/tours/route.ts",
  "src/app/api/distributor/tours/[id]/route.ts",
  "src/app/api/distributor/tours/[id]/pickup/route.ts",
  "src/app/api/distributor/tours/[id]/start/route.ts",
  "src/app/api/distributor/tours/[id]/pause/route.ts",
  "src/app/api/distributor/tours/[id]/resume/route.ts",
  "src/app/api/distributor/tours/[id]/complete/route.ts",
  "src/app/api/distributor/tours/[id]/photo/route.ts",
  "src/app/api/distributor/tours/[id]/gps/route.ts",
  "src/app/api/admin/tours/route.ts",
  "src/app/api/admin/tours/[id]/route.ts",
  "src/app/distributor/dashboard/page.tsx",
  "src/app/distributor/tours/[id]/page.tsx",
  "src/app/admin/tours/page.tsx",
  "src/app/admin/tours/[id]/page.tsx",
  "src/app/manifest.ts",
  "public/sw.js",
]) {
  assert(existsSync(path), `${path} fehlt.`);
}

const [tours, gpsPoints, photos, flaggedGps, assignedAudit, pickupReadyInventory] =
  await Promise.all([
    prisma.distributionTour.count(),
    prisma.gpsPoint.count(),
    prisma.photoProof.count(),
    prisma.gpsPoint.count({ where: { status: "flagged" } }),
    prisma.auditLog.count({ where: { action: "tour.assigned" } }),
    prisma.warehouseInventory.count({ where: { status: "READY_FOR_PICKUP", pickupStatus: "RESERVED" } }),
  ]);

assert(tours >= 5, "Es fehlen mindestens 5 Seed-Touren.");
assert(gpsPoints >= 8, "Es fehlen GPS-Seedpunkte.");
assert(photos >= 2, "Es fehlen Foto-Seednachweise.");
assert(flaggedGps >= 1, "Es fehlen GPS-Manipulationsflags.");
assert(assignedAudit >= 5, "Es fehlen tour.assigned AuditLogs.");
assert(pickupReadyInventory >= 1, "Es fehlt ein reservierter abholbereiter Lagerbestand.");

const statusCoverage = await prisma.distributionTour.groupBy({
  by: ["status"],
  _count: { _all: true },
});
const statuses = new Set(statusCoverage.map((row) => row.status));
for (const status of ["ASSIGNED", "PICKED_UP", "STARTED", "PAUSED", "UNDER_REVIEW"]) {
  assert(statuses.has(status), `Seed-Tourstatus fehlt: ${status}`);
}

await prisma.$disconnect();
console.log("Module 5 smoke checks passed.");
