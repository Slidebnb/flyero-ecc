import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const dashboard = await readFile("src/app/customer/dashboard/page.tsx", "utf8");
const reports = await readFile("src/lib/reports.ts", "utf8");
const notifications = await readFile("src/lib/notifications.ts", "utf8");
const worker = await readFile("src/lib/notificationWorker.ts", "utf8");
const emailTemplate = await readFile("src/lib/emailTemplates.ts", "utf8");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));

assert(dashboard.includes("CustomerLiveRefresh"), "Dashboard muss veröffentlichte Nachweise automatisch neu laden.");
assert(dashboard.includes('currentReport || currentEvidence ? "Nachweis verfügbar"'), "Freigegebene Berichte oder Nachweise muessen das Dashboard als verfuegbar anzeigen.");
assert(reports.includes('forceEmail: true'), "Berichtsfreigabe muss die Kunden-E-Mail unabhängig von optionalen Präferenzen vormerken.");
assert(reports.includes("campaignUrl"), "Berichtsfreigabe muss einen geschützten Portal-Link übergeben.");
assert(reports.includes("emailHtml"), "Berichtsfreigabe muss das gebrandete HTML-E-Mail-Layout übergeben.");
assert(notifications.includes("emailHtml"), "Benachrichtigungen müssen ein separates E-Mail-Layout unterstützen.");
assert(worker.includes("html: payload.html"), "Notification-Worker muss das gebrandete HTML an den Provider weitergeben.");
assert(emailTemplate.includes("Bericht im Kundenportal"), "Die Kunden-Mail muss den Portalzugang verstÃ¤ndlich anbieten.");
assert(!/Queue|Fingerprint|localhost|REPORT_PUBLISHED/.test(emailTemplate), "Das Kunden-Mail-Layout darf keine technischen Begriffe enthalten.");
assert(!/technisch geprueft|technisch geprüft/.test(emailTemplate), "Kundenmails dürfen keine interne technische Prüfformulierung enthalten.");
assert(packageJson.scripts?.["test:customer-report-publication"], "Regressionstest muss als npm-Script registriert sein.");

console.log("Customer report publication checks passed.");
