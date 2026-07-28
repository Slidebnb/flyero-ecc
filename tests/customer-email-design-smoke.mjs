import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { buildCustomerEmail, buildCustomerNotificationEmail } = await import("../src/lib/customerEmailTemplate.ts");

const shared = buildCustomerEmail({
  subject: "Ihr FLYERO-Nachweis ist verf\u00fcgbar",
  eyebrow: "NACHWEIS VERF\u00dcGBAR",
  title: "Ihr Nachweis ist verf\u00fcgbar",
  customerName: "Huwa Geb\u00e4udedienste",
  intro: "Die Unterlagen zu Ihrer Verteilung stehen jetzt in Ihrem Kundenportal bereit.",
  details: [
    { label: "Verteilgebiet", value: "56112 Lahnstein" },
    { label: "Auftrag", value: "FLY-2026-0001" },
  ],
  action: { label: "Nachweis im Kundenportal \u00f6ffnen", url: "https://flyero.org/customer/reports/1" },
});

assert.match(shared.html, /<!doctype html>/i);
assert.match(shared.html, /FLYERO/);
assert.match(shared.html, /NACHWEIS VERF\u00dcGBAR/);
assert.match(shared.html, /background:#101713/);
assert.match(shared.html, /background:#b7ff21/);
assert.match(shared.html, /Nachweis im Kundenportal \u00f6ffnen/);
assert.match(shared.text, /Huwa Geb\u00e4udedienste/);
assert.doesNotMatch(shared.html, /NotificationQueue|providerMessageId|RPT-SEED|pi_seed|localhost|\{\{|\[object Object\]/i);

const generic = buildCustomerNotificationEmail({
  type: "ORDER_CLARIFICATION_REQUESTED",
  subject: "R\u00fcckfrage zu Ihrer Kampagne",
  body: "Bitte erg\u00e4nzen Sie noch die gew\u00fcnschte Flyer-Menge im Kundenportal. Mehr Informationen: https://flyero.org/customer/dashboard",
  data: { dashboardUrl: "https://flyero.org/customer/dashboard" },
});
assert.match(generic.html, /FLYERO/);
assert.match(generic.html, /R\u00fcckfrage zu Ihrer Kampagne/);
assert.match(generic.html, /Kundenportal \u00f6ffnen/);
assert.doesNotMatch(generic.html, /Mehr Informationen:\s*https:\/\/flyero\.org\/customer\/dashboard/);
assert.doesNotMatch(generic.html, /Vollst\u00e4ndige Vorgangsdaten|NotificationQueue|Stripe|providerMessageId|RPT-SEED|pi_seed|localhost/i);

const notifications = await readFile("src/lib/notifications.ts", "utf8");
const worker = await readFile("src/lib/notificationWorker.ts", "utf8");
const verification = await readFile("src/lib/verificationEmail.ts", "utf8");
const payment = await readFile("src/lib/paymentConfirmation.ts", "utf8");
assert.match(notifications, /buildCustomerNotificationEmail/);
assert.match(notifications, /audience === NotificationAudience\.CUSTOMER/);
assert.match(worker, /payload\.html/);
assert.match(verification, /buildCustomerEmail/);
assert.match(payment, /buildCustomerEmail/);

console.log("Customer email design smoke passed.");
