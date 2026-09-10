import { readFileSync } from "node:fs";
function assert(condition, message) { if (!condition) throw new Error(message); }
const reports = readFileSync("src/lib/reports.ts", "utf8");
const notifications = readFileSync("src/lib/notifications.ts", "utf8");
const reviewWorkflow = readFileSync("src/lib/orderReviewWorkflow.ts", "utf8");
const adminStatusRoute = readFileSync("src/app/api/admin/orders/[id]/status/route.ts", "utf8");
assert(reports.includes('type: "REPORT_PUBLISHED"'), "Kunde muss nach Veröffentlichung benachrichtigt werden.");
assert(reports.includes("notifyAdmins"), "Admin-Auditbenachrichtigung fehlt.");
assert(notifications.includes("notificationQueue.create"), "E-Mail/In-App-Versand muss über die Queue laufen.");
assert(reviewWorkflow.includes("forceEmail: true"), "Admin-Review muss Kunden-E-Mails erzwingen können.");
assert(reviewWorkflow.includes("dispatchNotificationImmediately"), "Admin-Review muss die Kunden-E-Mail sofort anstoßen.");
assert(adminStatusRoute.includes("forceEmail: true"), "Manuelle Statusänderung muss eine Kunden-E-Mail erzwingen.");
assert(adminStatusRoute.includes("dispatchNotificationImmediately"), "Manuelle Statusänderung muss die Kunden-E-Mail sofort anstoßen.");
console.log("Order review notification checks passed.");
