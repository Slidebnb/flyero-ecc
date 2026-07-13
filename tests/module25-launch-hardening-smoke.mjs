import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readUtf8(filePath) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
  return readFile(filePath, "utf8");
}

const mockCompleteRoute = await readUtf8("src/app/api/payments/mock-complete/[id]/route.ts");
assert(
  mockCompleteRoute.includes("ENABLE_MOCK_PAYMENTS"),
  "Mock-Complete-Route ist noch nicht an expliziten Mock-Mode gebunden.",
);

const paymentsLib = await readUtf8("src/lib/payments.ts");
assert(
  paymentsLib.includes("ENABLE_MOCK_PAYMENTS"),
  "Payment-Library nutzt noch keinen expliziten Mock-Payment-Schalter.",
);

const invoicesLib = await readUtf8("src/lib/invoices.ts");
assert(
  !invoicesLib.includes("/generated/invoices/"),
  "Rechnungs-PDFs werden noch unter /generated/invoices veroeffentlicht.",
);

const reportsLib = await readUtf8("src/lib/reports.ts");
assert(
  !reportsLib.includes("/generated/reports/"),
  "Report-PDFs werden noch unter /generated/reports veroeffentlicht.",
);

const accountingLib = await readUtf8("src/lib/accountingExport.ts");
assert(
  !accountingLib.includes("public\", \"generated\", \"accounting") && !accountingLib.includes("/generated/accounting/"),
  "Accounting-CSV-Exports werden noch unter /generated/accounting veroeffentlicht.",
);

const generatedAssets = await readUtf8("src/lib/generatedAssets.ts");
assert(
  !generatedAssets.includes('path.join(/*turbopackIgnore: true*/ process.cwd(), "public"'),
  "Generated Assets haben weiterhin einen public-Fallback.",
);
assert(generatedAssets.includes("Generated Asset liegt nicht im privaten Storage"), "Legacy-Generated-Assets werden nicht blockiert.");

const invoiceDownloadRoute = await readUtf8("src/app/api/customer/invoices/[id]/download/route.ts");
assert(
  !invoiceDownloadRoute.includes('path.join(process.cwd(), "public"'),
  "Customer-Invoice-Download liest noch aus public/ statt privatem Speicher.",
);

const reportDownloadRoute = await readUtf8("src/app/api/customer/reports/[id]/download/route.ts");
assert(
  !reportDownloadRoute.includes('path.join(process.cwd(), "public"'),
  "Customer-Report-Download liest noch aus public/ statt privatem Speicher.",
);

const accountingDownloadRoute = await readUtf8("src/app/api/admin/accounting/exports/[id]/download/route.ts");
assert(
  !accountingDownloadRoute.includes('path.join(process.cwd(), "public"'),
  "Accounting-Export-Download liest noch aus public/ statt privatem Speicher.",
);

const validators = await readUtf8("src/lib/validators.ts");
assert(
  !validators.includes("url: z.string().min(1).optional()"),
  "Tour-Foto-Validierung erlaubt noch freie URLs.",
);

const toursLib = await readUtf8("src/lib/tours.ts");
assert(
  !toursLib.includes("url: input.url ?? input.imageDataUrl ?? \"\""),
  "Tour-Fotos werden noch direkt aus url/imageDataUrl gespeichert.",
);
assert(
  toursLib.includes("/api/proofs/"),
  "Tour-Fotos werden noch nicht ueber geschuetzte Proof-URLs ausgeliefert.",
);

assert(existsSync("src/app/api/proofs/[id]/route.ts"), "Geschuetzte Proof-Download-Route fehlt.");

const leadRoute = await readUtf8("src/app/api/leads/route.ts");
assert(
  leadRoute.includes("assertLeadSubmissionAllowed"),
  "Lead-Route prueft noch keinen Abuse-/Rate-Limit-Schutz.",
);
assert(
  leadRoute.includes("429") || leadRoute.includes("publicRateLimitResponse"),
  "Lead-Route liefert keinen expliziten 429-Status fuer zu viele Anfragen.",
);

const leadForm = await readUtf8("src/app/LeadForm.tsx");
assert(
  leadForm.includes('name="website"') && leadForm.includes('autoComplete="off"'),
  "Lead-Formular enthaelt keinen Honeypot gegen einfache Bots.",
);

const abuseLibExists = existsSync("src/lib/abuseProtection.ts");
const publicAbuseLibExists = existsSync("src/lib/publicAbuseProtection.ts");
assert(abuseLibExists && publicAbuseLibExists, "Zentrale Abuse-Protection fuer oeffentliche Formulare fehlt.");
if (abuseLibExists && publicAbuseLibExists) {
  const [abuseLib, publicAbuseLib] = await Promise.all([
    readUtf8("src/lib/abuseProtection.ts"),
    readUtf8("src/lib/publicAbuseProtection.ts"),
  ]);
  assert(publicAbuseLib.includes("PUBLIC_LEAD") && publicAbuseLib.includes("RATE_LIMIT_MAX"), "Lead-Rate-Limit ist nicht konfigurierbar.");
  assert(abuseLib.includes("honeypot"), "Honeypot-Pruefung fehlt in Abuse-Protection.");
}

const monitoringLib = await readUtf8("src/lib/monitoring.ts");
assert(
  !monitoringLib.includes("GOOGLE_MAPS_API_KEY"),
  "Monitoring nutzt noch den alten GOOGLE_MAPS_API_KEY Alias statt der getrennten Browser-/Server-Keys.",
);
assert(
  monitoringLib.includes("GOOGLE_MAPS_SERVER_KEY") && monitoringLib.includes("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY"),
  "Monitoring prueft Google Maps ENV nicht konsistent gegen Browser- und Server-Key.",
);

console.log("Module 25 launch hardening smoke checks passed.");
