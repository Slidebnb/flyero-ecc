import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const route = readFileSync("src/app/api/admin/customers/[id]/emails/resend/route.ts", "utf8");
const page = readFileSync("src/app/admin/customers/[id]/page.tsx", "utf8");
const component = readFileSync("src/app/admin/customers/[id]/CustomerEmailActions.tsx", "utf8");

assert(route.includes("requirePermission(Permission.CUSTOMER_EMAIL_SEND)"), "E-Mail-Wiederholung muss serverseitig geschützt sein.");
assert(route.includes("createCheckoutForOrder"), "Zahlungs-E-Mail muss den vorhandenen Stripe-Checkout verwenden.");
assert(route.includes("customerId"), "Die Route muss den Kundenbezug serverseitig prüfen.");
assert(route.includes("dispatchNotificationImmediately"), "Wiederholte E-Mails müssen sofort versendet werden.");
assert(route.includes("isReusableStripeCheckoutSession"), "Erneute Zahlungs-E-Mails müssen abgelaufene Stripe-Sessions erkennen.");
assert(route.includes("forceNewCheckout"), "Für abgelaufene Sessions muss ein neuer Auftrag-Link erzeugt werden.");
assert(page.includes("CustomerEmailActions"), "Das Kundenprofil muss den E-Mail-Bereich einbinden.");
assert(component.includes("disabled={Boolean(busy)}"), "Der Wiederholen-Button muss gegen Mehrfachklicks gesperrt werden.");
assert(component.includes("keine E-Mail-Adresse"), "Fehlende Kunden-E-Mail muss verständlich angezeigt werden.");
console.log("Customer email resend checks passed.");
