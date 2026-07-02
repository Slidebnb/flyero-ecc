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
  return content;
}

await includes("src/lib/routeAnalysis.ts", [
  "NO_GPS",
  "TOO_FEW_POINTS",
  "LARGE_GAP",
  "UNREALISTIC_SPEED",
  "NO_MOVEMENT",
  "OUTSIDE_TARGET_AREA",
  "MISSING_START",
  "MISSING_END",
]);

await includes("src/app/components/RouteMap.tsx", [
  "NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY",
  "Google Maps Key fehlt",
  "Polyline",
  "Marker",
  "fitBounds",
]);

await includes("src/lib/mapSnapshot.ts", ["GOOGLE_MAPS_SERVER_KEY", "Static-Maps-URL", "stabilen Karten-Fallback"]);
await includes("ARCHITECTURE_DECISIONS.md", ["Datenschutz", "RouteAnalysis", "Static-Maps"]);
await includes(".env.example", ["NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY", "GOOGLE_MAPS_SERVER_KEY"]);

for (const path of [
  "src/app/admin/tours/[id]/page.tsx",
  "src/app/customer/reports/page.tsx",
  "src/app/customer/reports/[id]/page.tsx",
  "src/app/api/admin/tours/[id]/approve/route.ts",
  "src/app/api/admin/tours/[id]/reject/route.ts",
  "src/app/api/admin/tours/[id]/clarify/route.ts",
  "src/app/api/admin/tours/[id]/note/route.ts",
  "src/app/api/customer/reports/route.ts",
  "src/app/api/customer/reports/[id]/route.ts",
  "src/app/api/tours/[id]/route-analysis/route.ts",
]) {
  assert(existsSync(path), `${path} fehlt.`);
}

const customerReportPage = await readFile("src/app/customer/reports/[id]/page.tsx", "utf8");
for (const forbidden of ["distributor.user.email", "distributor.phone", "birthDate", "adminInternalNote"]) {
  assert(!customerReportPage.includes(forbidden), `Kundenseite enthaelt private Daten: ${forbidden}`);
}
const reportService = await readFile("src/lib/reports.ts", "utf8");
assert(reportService.includes("Verteiler #"), "Report-Service anonymisiert Verteiler nicht.");

const [approvedTour, tooFewTour, rejectedTour, reports, approvedAudit] = await Promise.all([
  prisma.distributionTour.findFirst({ where: { status: "APPROVED" }, include: { gpsPoints: true, photoProofs: true, order: true } }),
  prisma.distributionTour.findFirst({ where: { status: "NEEDS_CLARIFICATION" }, include: { gpsPoints: true } }),
  prisma.distributionTour.findFirst({ where: { status: "REJECTED" }, include: { gpsPoints: true } }),
  prisma.report.count({ where: { status: { in: ["GENERATED", "APPROVED", "PUBLISHED"] }, tour: { status: "APPROVED" } } }),
  prisma.auditLog.count({ where: { action: "tour.approved" } }),
]);

assert(approvedTour, "Es fehlt eine freigegebene Tour.");
assert(approvedTour.gpsPoints.length >= 3, "Freigegebene Tour hat zu wenige GPS-Punkte.");
assert(approvedTour.photoProofs.length >= 1, "Freigegebene Tour hat keine Fotos.");
assert(tooFewTour && tooFewTour.gpsPoints.length < 3, "Seed fuer TOO_FEW_POINTS fehlt.");
assert(rejectedTour && JSON.stringify(rejectedTour.fraudFlags).includes("UNREALISTIC_SPEED"), "Seed fuer unrealistische Geschwindigkeit fehlt.");
assert(reports >= 1, "Freigegebene Berichtsvorschau fehlt.");
assert(approvedAudit >= 1, "tour.approved AuditLog fehlt.");

await prisma.$disconnect();
console.log("Module 6 smoke checks passed.");
