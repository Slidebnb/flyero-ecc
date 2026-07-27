import assert from "node:assert/strict";
import fs from "node:fs";

const evidenceService = fs.readFileSync("src/lib/externalEvidence.ts", "utf8");
const customerReportRoute = fs.readFileSync("src/app/api/customer/reports/[id]/download/route.ts", "utf8");
const customerReportPage = fs.readFileSync("src/app/customer/reports/[id]/page.tsx", "utf8");

assert.match(evidenceService, /generatePdf/, "Der externe Bericht muss die zentrale PDF-Erzeugung verwenden.");
assert.match(evidenceService, /generatePdf\(report\.id\)/, "Die PDF-Erzeugung muss beim Vorbereiten des externen Berichts erfolgen.");
assert.match(evidenceService, /pdfUrl: pdf\.pdfUrl/, "Die erzeugte PDF-Adresse muss am Report gespeichert werden.");
assert.match(customerReportRoute, /report\.pdfUrl/, "Der geschuetzte Kunden-Download muss den gespeicherten Report-Pfad verwenden.");
assert.match(customerReportPage, /PDF herunterladen/, "Der Kundenbericht muss den PDF-Download anzeigen.");
assert.match(customerReportPage, /Nachweis herunterladen/, "Der Kundenbericht muss freigegebene Zusatznachweise anzeigen.");

console.log("External report PDF smoke checks passed.");
