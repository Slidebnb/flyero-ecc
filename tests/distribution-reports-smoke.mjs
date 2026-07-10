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

async function read(path) {
  assert(existsSync(path), `${path} fehlt.`);
  return readFile(path, "utf8");
}

const schema = await read("prisma/schema.prisma");
for (const snippet of [
  "model DistributionTour",
  "model GpsPoint",
  "model PhotoProof",
  "model Report",
  "model DistributionDeviation",
  "internalReviewStatus",
  "reportSnapshot",
  "actualRouteGeometry",
  "customerVisible",
  "reviewStatus",
  "receivedAt",
]) {
  assert(schema.includes(snippet), `Schema enthaelt nicht: ${snippet}`);
}

const reportsService = await read("src/lib/reports.ts");
for (const snippet of [
  "buildReportSnapshot",
  "customerGpsStatus",
  "calculateCoverageSummary",
  "approvedCustomerPhotos",
  "reportSnapshot",
  "REPORT_PUBLISHED",
]) {
  assert(reportsService.includes(snippet), `Report-Service enthaelt nicht: ${snippet}`);
}
assert(!reportsService.includes("Math.random"), "Report-Service darf keine Fake-Zufallsdaten erzeugen.");
assert(reportsService.includes('status === "PUBLISHED"'), "Kundenberichte duerfen nur veroeffentlicht sichtbar sein.");

const toursService = await read("src/lib/tours.ts");
for (const snippet of [
  "receivedAt",
  "gpsPointCount",
  "gpsQualityScore",
  "actualRouteGeometry",
  "customerVisible: false",
]) {
  assert(toursService.includes(snippet), `Tour-Service enthaelt nicht: ${snippet}`);
}
assert(!toursService.includes("Math.random"), "Tour-Service darf keine Fake-GPS-Daten erzeugen.");

const customerReportPage = await read("src/app/customer/reports/[id]/page.tsx");
for (const forbidden of ["GPS-Qualit", "/100", "fraudFlags", "adminInternalNote", "distributor.user.email"]) {
  assert(!customerReportPage.includes(forbidden), `Kundenbericht zeigt technische/interne Daten: ${forbidden}`);
}
for (const snippet of ["Von FLYERO geprueft", "Geplant", "Tatsaechlich dokumentiert", "PDF herunterladen"]) {
  assert(customerReportPage.includes(snippet), `Kundenbericht enthaelt nicht: ${snippet}`);
}

const customerDownload = await read("src/app/api/customer/reports/[id]/download/route.ts");
assert(customerDownload.includes('status: "PUBLISHED"'), "Customer-PDF-Download muss auf veroeffentlichte Berichte begrenzt sein.");

const adminReportPage = await read("src/app/admin/reports/[id]/page.tsx");
for (const snippet of ["GPS-Score", "Pruefstatus", "Abweichungen", "Foto-Freigaben"]) {
  assert(adminReportPage.includes(snippet), `Adminbericht enthaelt nicht: ${snippet}`);
}

const generatedReport = await prisma.report.findFirst({
  where: { status: { in: ["GENERATED", "APPROVED"] } },
});
if (generatedReport) {
  const customerVisible = await prisma.report.findFirst({
    where: { id: generatedReport.id, status: "PUBLISHED" },
  });
  assert(!customerVisible, "Nicht veroeffentlichter Bericht darf nicht als Kundenbericht gelten.");
}

await prisma.$disconnect();
console.log("Distribution report smoke checks passed.");
