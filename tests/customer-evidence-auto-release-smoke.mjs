import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const evidence = await readFile("src/lib/externalEvidence.ts", "utf8");
const emailTemplates = await readFile("src/lib/emailTemplates.ts", "utf8");
const shell = await readFile("src/app/customer/CustomerPortalShell.tsx", "utf8");
const wizard = await readFile("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const orderDetail = await readFile("src/app/customer/orders/[id]/page.tsx", "utf8");
const documents = await readFile("src/app/customer/documents/page.tsx", "utf8");
const orderDocuments = await readFile("src/app/customer/orders/[id]/documents/page.tsx", "utf8");

assert.match(evidence, /const autoRelease = stored\.scanStatus === "CLEAN"/, "Admin-Nachweise brauchen einen expliziten Clean-Scan-Freigabepfad.");
assert.match(evidence, /customerVisible: autoRelease/, "Saubere Nachweise muessen automatisch kundensichtbar werden.");
assert.match(evidence, /reviewStatus: autoRelease \? "APPROVED" : "PENDING"/, "Die Freigabe muss vom Scanstatus abhaengen.");
assert.match(evidence, /DOCUMENT_APPROVED|REPORT_PUBLISHED/, "Die automatische Freigabe muss eine bestehende Kundenbenachrichtigung ausloesen.");
assert.match(evidence, /emailHtml: evidenceEmail\.html/, "Die automatische Freigabe muss das gebrandete Nachweis-Mail verwenden.");
assert.match(emailTemplates, /buildEvidenceAvailableEmail/, "Das Nachweis-Mail braucht ein eigenes kundenfreundliches Layout.");
assert.doesNotMatch(shell, /label: "Dateien"/, "Der allgemeine Dateimanager darf nicht im Kunden-Hauptmenue stehen.");
assert.doesNotMatch(wizard, /label: "Dateien"/, "Der Kundenwizard darf nicht in den allgemeinen Dateimanager fuehren.");
assert.doesNotMatch(orderDetail, /Dateien [Ã¶o]ffnen/, "Die Kampagnendetailseite darf keinen allgemeinen Datei-CTA zeigen.");

assert.match(documents, /redirect\("\/customer\/reports"\)/, "Die alte Kundendateiseite muss auf die Nachweise weiterleiten.");
assert.match(orderDocuments, /redirect\("\/customer\/reports"\)/, "Die alte kampagnenbezogene Dateiseite muss auf die Nachweise weiterleiten.");

console.log("Customer evidence auto-release smoke checks passed.");
