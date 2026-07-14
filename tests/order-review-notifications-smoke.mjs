import { readFileSync } from "node:fs";
function assert(condition, message) { if (!condition) throw new Error(message); }
const reports = readFileSync("src/lib/reports.ts", "utf8");
const notifications = readFileSync("src/lib/notifications.ts", "utf8");
assert(reports.includes('type: "REPORT_PUBLISHED"'), "Kunde muss nach Veröffentlichung benachrichtigt werden.");
assert(reports.includes("notifyAdmins"), "Admin-Auditbenachrichtigung fehlt.");
assert(notifications.includes("notificationQueue.create"), "E-Mail/In-App-Versand muss über die Queue laufen.");
console.log("Order review notification checks passed.");
