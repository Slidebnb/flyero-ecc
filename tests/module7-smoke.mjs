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

async function includes(path, snippets) {
  assert(existsSync(path), `${path} fehlt.`);
  const content = await readFile(path, "utf8");
  for (const snippet of snippets) {
    assert(content.includes(snippet), `${path} enthaelt nicht: ${snippet}`);
  }
}

await includes("prisma/schema.prisma", [
  "DispatchAssignment",
  "DispatchAssignmentStatus",
  "DispatchRejectionReason",
  "maxToursPerDay",
  "maxFlyersPerDay",
  "currentAssignedFlyers",
  "currentAssignedTours",
  "availableToday",
  "dispatchAssignments",
]);

await includes("src/lib/dispatch.ts", [
  "getSuitableDistributors",
  "assignOrderToDistributor",
  "acceptDispatchOrder",
  "rejectDispatchOrder",
  "capacityWarning",
  "dispatch.assigned",
  "dispatch.unassigned",
  "dispatch.accepted",
  "dispatch.rejected",
  "DISPATCH_CAPACITY_EXCEEDED",
]);

for (const path of [
  "src/app/admin/dispatch/page.tsx",
  "src/app/api/admin/dispatch/route.ts",
  "src/app/api/admin/orders/[id]/assign/route.ts",
  "src/app/api/distributor/available-orders/route.ts",
  "src/app/api/distributor/orders/[id]/accept/route.ts",
  "src/app/api/distributor/orders/[id]/reject/route.ts",
]) {
  assert(existsSync(path), `${path} fehlt.`);
}

await includes("src/app/admin/dispatch/page.tsx", [
  "Nicht zugewiesene Aufträge",
  "Kapazität überschritten",
  "Zugewiesene Aufträge",
  "Laufende Touren",
  "Abgeschlossene Touren",
]);

await includes("src/app/distributor/dashboard/page.tsx", [
  "Neue Aufträge",
  "Annehmen",
  "Ablehnen",
  "DISPATCH_REJECTION_REASON_LABELS",
]);

await includes("README.md", ["Modul 7", "/admin/dispatch", "Dispatch"]);
await includes("ARCHITECTURE_DECISIONS.md", ["Dispatch", "Kapazitaet", "Auto-Dispatch"]);

const [
  orderCount,
  distributorCount,
  capacityProfiles,
  acceptedAssignment,
  rejectedAssignment,
  assignedAssignment,
  reservedInventory,
  dispatchAuditCount,
  dispatchNotifications,
] = await Promise.all([
  prisma.order.count(),
  prisma.distributorProfile.count(),
  prisma.distributorProfile.count({
    where: {
      maxToursPerDay: { gt: 0 },
      maxFlyersPerDay: { gt: 0 },
    },
  }),
  prisma.dispatchAssignment.findFirst({ where: { status: "ACCEPTED" }, include: { inventory: true } }),
  prisma.dispatchAssignment.findFirst({ where: { status: "REJECTED", rejectionReason: { not: null } } }),
  prisma.dispatchAssignment.findFirst({ where: { status: "ASSIGNED" } }),
  prisma.warehouseInventory.findFirst({ where: { pickupStatus: "RESERVED", reservedDistributorId: { not: null } } }),
  prisma.auditLog.count({ where: { action: { in: ["dispatch.assigned", "dispatch.unassigned", "dispatch.accepted", "dispatch.rejected", "dispatch.reassigned"] } } }),
  prisma.notification.count({ where: { type: { startsWith: "DISPATCH_" } } }),
]);

assert(orderCount >= 20, "Seed enthaelt weniger als 20 Auftraege.");
assert(distributorCount >= 10, "Seed enthaelt weniger als 10 Verteiler.");
assert(capacityProfiles >= 10, "Nicht alle Verteiler haben Kapazitaetsfelder.");
assert(acceptedAssignment, "Angenommene Dispatch-Zuweisung fehlt.");
assert(acceptedAssignment.inventory?.pickupStatus === "RESERVED", "Angenommene Zuweisung reserviert den Bestand nicht.");
assert(rejectedAssignment, "Abgelehnte Dispatch-Zuweisung mit Grund fehlt.");
assert(assignedAssignment, "Offene Dispatch-Anfrage fehlt.");
assert(reservedInventory, "Reservierter Lagerbestand fehlt.");
assert(dispatchAuditCount >= 3, "Dispatch-AuditLogs fehlen.");
assert(dispatchNotifications >= 3, "Dispatch-Notifications fehlen.");

await prisma.$disconnect();
console.log("Module 7 smoke checks passed.");
