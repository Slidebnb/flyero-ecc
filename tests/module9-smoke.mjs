import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function includes(filePath, snippets) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
  const content = await readFile(filePath, "utf8");
  for (const snippet of snippets) {
    assert(content.includes(snippet), `${filePath} enthaelt nicht: ${snippet}`);
  }
  return content;
}

function includesAny(content, alternatives, filePath) {
  assert(
    alternatives.some((snippet) => content.includes(snippet)),
    `${filePath} enthaelt keine der erwarteten Varianten: ${alternatives.join(" | ")}`,
  );
}

await includes("prisma/schema.prisma", [
  "enum ReportType",
  "DISTRIBUTION_PROOF",
  "enum ReportTemplate",
  "CUSTOM_BRANDING",
  "PUBLISHED",
  "ARCHIVED",
  "reportNumber",
  "verificationCode",
  "approvedById",
  "checksum",
]);

await includes("src/lib/reports.ts", [
  "createReportForTour",
  "generateReportNumber",
  "collectReportData",
  "sanitizeReportForCustomer",
  "generateOnlineReportUrl",
  "generatePdf",
  "publishReport",
  "archiveReport",
  "regenerateReport",
  "report.generated",
  "report.published",
  "report.downloaded",
  "REPORT_AVAILABLE",
]);

for (const filePath of [
  "src/app/api/admin/tours/[id]/generate-report/route.ts",
  "src/app/api/admin/reports/route.ts",
  "src/app/api/admin/reports/[id]/route.ts",
  "src/app/api/admin/reports/[id]/regenerate/route.ts",
  "src/app/api/admin/reports/[id]/publish/route.ts",
  "src/app/api/admin/reports/[id]/archive/route.ts",
  "src/app/api/customer/reports/route.ts",
  "src/app/api/customer/reports/[id]/route.ts",
  "src/app/api/customer/reports/[id]/download/route.ts",
  "src/app/api/reports/verify/[code]/route.ts",
  "src/app/admin/reports/page.tsx",
  "src/app/admin/reports/[id]/page.tsx",
  "src/app/customer/reports/page.tsx",
  "src/app/customer/reports/[id]/page.tsx",
]) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
}

const customerReportPage = await includes("src/app/customer/reports/[id]/page.tsx", ["Standort anonymisiert", "Verteiler"]);
includesAny(customerReportPage, ["Flyero Verteilnachweis", "FLYERO Verteilnachweis"], "src/app/customer/reports/[id]/page.tsx");
includesAny(customerReportPage, ["GPS-Qualitaet", "GPS-Qualität", "GPS-QualitÃ¤t"], "src/app/customer/reports/[id]/page.tsx");
includesAny(customerReportPage, ["Digitale Pruefnummer", "Digitale Prüfnummer", "Digitale PrÃ¼fnummer"], "src/app/customer/reports/[id]/page.tsx");
for (const forbidden of ["distributor.user.email", "distributor.phone", "birthDate", "adminInternalNote", "fraudFlags"]) {
  assert(!customerReportPage.includes(forbidden), `Kundenseite enthaelt private Daten: ${forbidden}`);
}

const adminTourPage = await includes("src/app/admin/tours/[id]/page.tsx", [
  "Bericht generieren",
  "Neu generieren",
  "Archivieren",
]);
includesAny(adminTourPage, ["Veroeffentlichen", "Veröffentlichen", "VerÃ¶ffentlichen"], "src/app/admin/tours/[id]/page.tsx");
await includes("src/lib/mapSnapshot.ts", ["GOOGLE_MAPS_SERVER_KEY", "Static-Maps-URL", "stabilen Karten-Fallback"]);
await includes("README.md", ["Modul 9", "Verteilberichte", "PDF"]);
await includes("ARCHITECTURE_DECISIONS.md", ["ReportStatus", "DISTRIBUTION_PROOF", "Kundendatenschutz"]);

const [
  publishedReport,
  draftReport,
  reportCount,
  uniqueReportNumberCount,
  generatedAudit,
  publishedAudit,
  notifications,
] = await Promise.all([
  prisma.report.findFirst({
    where: { status: "PUBLISHED", pdfUrl: { not: null } },
    include: { order: { include: { customer: true } }, tour: { include: { gpsPoints: true, photoProofs: true } } },
  }),
  prisma.report.findFirst({ where: { status: { in: ["DRAFT", "GENERATED"] } } }),
  prisma.report.count(),
  prisma.report.groupBy({ by: ["reportNumber"] }),
  prisma.auditLog.count({ where: { action: "report.generated" } }),
  prisma.auditLog.count({ where: { action: "report.published" } }),
  prisma.notification.count({ where: { type: { in: ["REPORT_AVAILABLE", "REPORT_PUBLISHED", "REPORT_GENERATED"] } } }),
]);

assert(reportCount >= 2, "Seed enthaelt weniger als zwei Berichte.");
assert(uniqueReportNumberCount.length === reportCount, "Berichtnummern sind nicht eindeutig.");
assert(publishedReport, "Veroeffentlichter Bericht mit PDF fehlt.");
assert(draftReport, "Draft- oder Generated-Bericht fehlt.");
assert(publishedReport.tour.gpsPoints.length >= 3, "Veroeffentlichter Bericht hat keine ausreichende GPS-Route.");
assert(publishedReport.tour.photoProofs.length >= 1, "Veroeffentlichter Bericht hat keine Fotodokumentation.");
assert(publishedReport.checksum && publishedReport.checksum.length >= 32, "PDF-Checksumme fehlt.");
assert(publishedReport.verificationCode, "Verification-Code fehlt.");
assert(generatedAudit >= 1, "report.generated AuditLog fehlt.");
assert(publishedAudit >= 1, "report.published AuditLog fehlt.");
assert(notifications >= 1, "Report-Benachrichtigungen fehlen.");

const pdfPath = publishedReport.pdfUrl.startsWith("/private/generated/reports/")
  ? path.join(process.cwd(), "storage", publishedReport.pdfUrl.replace(/^\/+private\/generated\/reports\//, "generated/reports/"))
  : path.join(process.cwd(), "public", publishedReport.pdfUrl.replace(/^\/+/, ""));
assert(existsSync(pdfPath), `PDF-Datei fehlt: ${pdfPath}`);
const pdfHeader = await readFile(pdfPath, "utf8");
assert(pdfHeader.startsWith("%PDF-"), "PDF-Datei hat keinen PDF-Header.");

await prisma.$disconnect();
console.log("Module 9 smoke checks passed.");
