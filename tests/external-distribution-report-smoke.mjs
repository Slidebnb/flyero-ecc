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
  "enum ReportSource",
  "EXTERNAL_GPS_REPORT",
  "MANUAL_EVIDENCE",
  "INTERNAL_TRACKING",
  "HYBRID",
  "providerName",
  "externalReportReference",
  "reportDate",
  "customerVisible",
  "model ManualDistributor",
]) {
  assert(schema.includes(snippet), `Schema enthält nicht: ${snippet}`);
}

const storage = await read("src/lib/documentStorage.ts");
for (const extension of ['"gpx"', '"kml"', '"kmz"', '"webp"']) {
  assert(storage.includes(extension), `Dokument-Storage erlaubt ${extension} nicht.`);
}

const evidenceService = await read("src/lib/externalEvidence.ts");
for (const snippet of [
  "uploadExternalEvidence",
  "prepareExternalReportForOrder",
  "publishExternalReport",
  "assertEvidenceFileMatchesType",
  "manualDistributorName",
  "Nachweis basiert auf externem GPS-Bericht und manueller Prüfung.",
  "EXTERNAL_GPS_REPORT",
  "customerVisible: false",
]) {
  assert(evidenceService.includes(snippet), `External-Evidence-Service enthält nicht: ${snippet}`);
}
assert(!evidenceService.includes("Math.random"), "External-Evidence-Service darf keine Fake-Daten erzeugen.");
assert(!evidenceService.includes("actualCoveragePercent: new Prisma.Decimal"), "Externe MVP-Reports dürfen keine Fake-Coverage setzen.");

for (const filePath of [
  "src/app/api/admin/orders/[id]/evidence/route.ts",
  "src/app/api/admin/orders/[id]/evidence/prepare-report/route.ts",
  "src/app/api/customer/reports/[id]/evidence/[documentId]/route.ts",
  "MVP_DISTRIBUTION_EVIDENCE.md",
]) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
}

const adminOrderPage = await read("src/app/admin/orders/[id]/page.tsx");
for (const snippet of [
  "Verteilnachweise",
  "GPS-Bericht hochladen",
  "Bericht vorbereiten",
  "Bericht veröffentlichen",
]) {
  assert(adminOrderPage.includes(snippet), `Admin-Auftrag enthält nicht: ${snippet}`);
}

const customerReportPage = await read("src/app/customer/reports/[id]/page.tsx");
for (const snippet of [
  "GPS-Nachweis des eingesetzten Trackingsystems",
  "Nachweis basiert auf externem GPS-Bericht",
  "Weitere Nachweise",
]) {
  assert(customerReportPage.includes(snippet), `Kundenbericht enthält nicht: ${snippet}`);
}
assert(!customerReportPage.includes("live aufgezeichnet"), "Kundenbericht darf kein Live-Tracking behaupten.");

const approvedExternalDoc = await prisma.document.findFirst({
  where: {
    documentType: "REPORT",
    providerName: { not: null },
    customerVisible: true,
    status: "APPROVED",
  },
});
if (approvedExternalDoc) {
  const report = await prisma.report.findFirst({
    where: { orderId: approvedExternalDoc.orderId, status: "PUBLISHED", reportSource: "EXTERNAL_GPS_REPORT" },
  });
  assert(report, "Freigegebener externer GPS-Bericht muss mit einem veröffentlichten Report verknüpft sein.");
  assert(report.actualCoveragePercent === null, "Externer MVP-Report darf ohne Rohdaten keine automatische Coverage behaupten.");
}

await prisma.$disconnect();
console.log("External distribution report smoke checks passed.");
