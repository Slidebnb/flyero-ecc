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
  assert(schema.includes(snippet), `Schema enth?lt nicht: ${snippet}`);
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
  assert(reportsService.includes(snippet), `Report-Service enth?lt nicht: ${snippet}`);
}
assert(!reportsService.includes("Math.random"), "Report-Service darf keine Fake-Zufallsdaten erzeugen.");
assert(reportsService.includes('status === "PUBLISHED"'), "Kundenberichte d\u00fcrfen nur ver\u00f6ffentlicht sichtbar sein.");

const toursService = await read("src/lib/tours.ts");
for (const snippet of [
  "receivedAt",
  "gpsPointCount",
  "gpsQualityScore",
  "actualRouteGeometry",
  "customerVisible: false",
]) {
  assert(toursService.includes(snippet), `Tour-Service enth?lt nicht: ${snippet}`);
}
assert(!toursService.includes("Math.random"), "Tour-Service darf keine Fake-GPS-Daten erzeugen.");

const customerReportPage = await read("src/app/customer/reports/[id]/page.tsx");
for (const forbidden of ["GPS-Qualit", "/100", "fraudFlags", "adminInternalNote", "distributor.user.email"]) {
  assert(!customerReportPage.includes(forbidden), `Kundenbericht zeigt technische/interne Daten: ${forbidden}`);
}
for (const snippet of ["Von FLYERO gepr\u00fcft", "Geplant", "Dokumentiert verteilt", "PDF herunterladen"]) {
  assert(customerReportPage.includes(snippet), `Kundenbericht enth\u00e4lt nicht: ${snippet}`);
}

const customerDownload = await read("src/app/api/customer/reports/[id]/download/route.ts");
assert(customerDownload.includes('status: "PUBLISHED"'), "Customer-PDF-Download muss auf ver\u00f6ffentlichte Berichte begrenzt sein.");

const adminReportPage = await read("src/app/admin/reports/[id]/page.tsx");
for (const snippet of ["GPS-Score", "Pr\u00fcfstatus", "Abweichungen", "Foto-Freigaben"]) {
  assert(adminReportPage.includes(snippet), `Adminbericht enth\u00e4lt nicht: ${snippet}`);
}

const generatedReport = await prisma.report.findFirst({
  where: { status: { in: ["GENERATED", "APPROVED"] } },
});
if (generatedReport) {
  const customerVisible = await prisma.report.findFirst({
    where: { id: generatedReport.id, status: "PUBLISHED" },
  });
  assert(!customerVisible, "Nicht ver\u00f6ffentlichter Bericht darf nicht als Kundenbericht gelten.");
}

await prisma.$disconnect();
console.log("Distribution report smoke checks passed.");
