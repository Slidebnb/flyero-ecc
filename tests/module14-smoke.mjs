import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
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

await includes("prisma/schema.prisma", [
  "enum AutoDispatchRecommendationStatus",
  "model AutoDispatchRecommendation",
  "autoDispatchEnabled",
  "autoDispatchMinScore",
]);

await includes("src/lib/dispatch.ts", [
  "createAutoDispatchRecommendations",
  "dismissAutoDispatchRecommendation",
  "autoAssignRecommendedDistributor",
  "dispatch.recommendation_created",
  "dispatch.recommendation_selected",
  "dispatch.recommendation_dismissed",
  "dispatch.auto_assigned",
  "dispatch.auto_assign_skipped",
  "rejectionRate",
]);

for (const filePath of [
  "src/app/api/admin/dispatch/recommend/[orderId]/route.ts",
  "src/app/api/admin/dispatch/auto-assign/[orderId]/route.ts",
  "src/app/api/admin/dispatch/recommendations/route.ts",
  "src/app/api/admin/dispatch/recommendations/[id]/dismiss/route.ts",
]) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
}

await includes("src/app/admin/dispatch/page.tsx", ["Top Empfehlung", "Score", "Warnungen", "Empfehlung ignorieren"]);
const dispatchPage = await readFile("src/app/admin/dispatch/page.tsx", "utf8");
assert(dispatchPage.includes("Gründe") || dispatchPage.includes("Gruende"), "Dispatch-Seite enthaelt keine Gruende-Spalte.");
await includes("README.md", ["Modul 14", "Auto-Dispatch", "MinScore", "regelbasiert"]);
await includes("ARCHITECTURE_DECISIONS.md", ["Auto-Dispatch", "regelbasiert", "nicht KI"]);

const [
  recommendationCount,
  selectedCount,
  dismissedCount,
  highScoreCount,
  warningCount,
  systemCount,
  approvedActiveCount,
  pausedOrRejectedUsers,
  auditCreated,
  auditSelected,
  auditDismissed,
  auditAutoAssigned,
  auditSkipped,
  notifications,
] = await Promise.all([
  prisma.autoDispatchRecommendation.count(),
  prisma.autoDispatchRecommendation.count({ where: { status: "SELECTED" } }),
  prisma.autoDispatchRecommendation.count({ where: { status: "DISMISSED" } }),
  prisma.autoDispatchRecommendation.count({ where: { score: { gte: 80 } } }),
  prisma.autoDispatchRecommendation.count({ where: { warnings: { not: [] } } }),
  prisma.systemSettings.count({ where: { autoDispatchEnabled: false, autoDispatchMinScore: { gte: 1 } } }),
  prisma.distributorProfile.count({ where: { reviewStatus: "APPROVED", user: { status: "ACTIVE" } } }),
  prisma.distributorProfile.count({ where: { OR: [{ reviewStatus: { in: ["PAUSED", "REJECTED", "BANNED"] } }, { user: { status: { not: "ACTIVE" } } }] } }),
  prisma.auditLog.count({ where: { action: "dispatch.recommendation_created" } }),
  prisma.auditLog.count({ where: { action: "dispatch.recommendation_selected" } }),
  prisma.auditLog.count({ where: { action: "dispatch.recommendation_dismissed" } }),
  prisma.auditLog.count({ where: { action: "dispatch.auto_assigned" } }),
  prisma.auditLog.count({ where: { action: "dispatch.auto_assign_skipped" } }),
  prisma.notification.count({ where: { type: { in: ["DISPATCH_RECOMMENDATIONS_CREATED", "DISPATCH_AUTO_ASSIGNED", "DISPATCH_AUTO_ASSIGN_SKIPPED", "DISPATCH_AUTO_ASSIGNED_ORDER"] } } }),
]);

assert(recommendationCount >= 6, "AutoDispatchRecommendations fehlen.");
assert(selectedCount >= 1, "SELECTED Recommendation fehlt.");
assert(dismissedCount >= 1, "DISMISSED Recommendation fehlt.");
assert(highScoreCount >= 1, "Gute Scores fehlen.");
assert(warningCount >= 1, "Warnungen fehlen.");
assert(systemCount >= 1, "SystemSettings Auto-Dispatch Felder fehlen.");
assert(approvedActiveCount >= 3, "Approved/aktive Verteiler fehlen.");
assert(pausedOrRejectedUsers >= 1, "Pausierte/gesperrte Verteiler fuer Ausschluss fehlen.");
assert(auditCreated >= 1, "dispatch.recommendation_created AuditLog fehlt.");
assert(auditSelected >= 1, "dispatch.recommendation_selected AuditLog fehlt.");
assert(auditDismissed >= 1, "dispatch.recommendation_dismissed AuditLog fehlt.");
assert(auditAutoAssigned >= 1, "dispatch.auto_assigned AuditLog fehlt.");
assert(auditSkipped >= 1, "dispatch.auto_assign_skipped AuditLog fehlt.");
assert(notifications >= 4, "Auto-Dispatch Notifications fehlen.");

const best = await prisma.autoDispatchRecommendation.findFirst({ orderBy: { score: "desc" }, include: { distributor: true } });
const worst = await prisma.autoDispatchRecommendation.findFirst({ orderBy: { score: "asc" }, include: { distributor: true } });
assert(best && worst && best.score > worst.score, "Scoreberechnung bildet keine Rangfolge ab.");

await prisma.$disconnect();
console.log("Module 14 smoke checks passed.");
