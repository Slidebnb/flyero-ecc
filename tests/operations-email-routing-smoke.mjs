import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const notifications = readFileSync("src/lib/notifications.ts", "utf8");
const worker = readFileSync("src/lib/notificationWorker.ts", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const leads = readFileSync("src/lib/leads.ts", "utf8");
const orders = readFileSync("src/app/api/customer/orders/route.ts", "utf8");
const payments = readFileSync("src/lib/payments.ts", "utf8");
const productionEnv = readFileSync(".env.production.example", "utf8");
const productionData = readFileSync("src/lib/productionData.ts", "utf8");

assert.match(productionEnv, /^OPERATIONS_EMAIL="hallo@flyero\.org"$/m, "Produktionsadresse hallo@flyero.org fehlt.");
assert.match(schema, /model NotificationMessage \{[\s\S]*?userId\s+String\?/m, "NotificationMessage muss direkte Empfaenger ohne Benutzerkonto erlauben.");
assert.match(schema, /model NotificationQueue \{[\s\S]*?userId\s+String\?[\s\S]*?recipientEmail\s+String\?/m, "NotificationQueue braucht eine direkte Empfaengeradresse.");
assert.match(notifications, /export async function notifyOperations\(/, "Operations-Benachrichtigung fehlt.");
assert.match(notifications, /notifyOperations\(input\)/, "notifyAdmins leitet nicht an die Betriebsadresse weiter.");
assert.match(worker, /queue\.recipientEmail \?\? queue\.user\?\.email/, "Worker verwendet die direkte Empfaengeradresse nicht.");
assert.match(productionData, /recipientEmail|userId: null/, "Produktionsfilter beruecksichtigt direkte Betriebs-Queue-Empfaenger nicht.");
assert.match(leads, /companyName: lead\.companyName/, "Lead-Mail enthaelt nicht den Firmennamen.");
assert.match(leads, /phone: lead\.phone/, "Lead-Mail enthaelt nicht die Telefonnummer.");
assert.match(leads, /message: lead\.message/, "Lead-Mail enthaelt nicht die vollstaendige Nachricht.");
assert.match(orders, /completionPath: data\.completionPath/, "Auftrags-Mail enthaelt nicht den Abschlussweg.");
assert.match(orders, /netAmount:/, "Auftrags-Mail enthaelt nicht den Netto-Betrag.");
assert.match(orders, /vatAmount:/, "Auftrags-Mail enthaelt nicht den MwSt.-Betrag.");
assert.match(payments, /type: "PAYMENT_CHECKOUT_CREATED"/, "Checkout-Start meldet keine Betriebs-E-Mail.");
assert.match(payments, /type: "PAYMENT_FAILED"/, "Fehlgeschlagene Zahlung meldet keine Betriebs-E-Mail.");
assert.match(payments, /paymentId: paidPayment\.id/, "Zahlungs-Mail enthaelt nicht die Payment-ID.");
assert.match(payments, /grossAmount: paidPayment\.amount/, "Zahlungs-Mail enthaelt nicht den Zahlungsbetrag.");

console.log("Operations email routing smoke checks passed.");
