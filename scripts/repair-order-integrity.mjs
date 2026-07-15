import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const apply = process.argv.includes("--apply");

if (apply) {
  console.error("Automatische Reparaturen sind in Modul 27.1 absichtlich gesperrt. Erst Diagnose und manuelle Freigabe.");
  await prisma.$disconnect();
  process.exitCode = 2;
} else {
  const orders = await prisma.order.findMany({
    where: { NOT: { orderNumber: { startsWith: "DEMO-" } } },
    orderBy: { createdAt: "asc" },
    take: Number(process.env.INTEGRITY_AUDIT_LIMIT || 100),
    select: { id: true, orderNumber: true, status: true, targetAreaGeoJson: true, priceRuleSnapshot: true },
  });
  console.log(JSON.stringify({
    mode: "dry-run",
    scanned: orders.length,
    candidates: orders.filter((order) => !order.targetAreaGeoJson || !order.priceRuleSnapshot).map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      reasons: [
        !order.targetAreaGeoJson ? "targetAreaGeoJson fehlt" : null,
        !order.priceRuleSnapshot ? "priceRuleSnapshot fehlt" : null,
      ].filter(Boolean),
    })),
    writesPerformed: false,
  }, null, 2));
  await prisma.$disconnect();
}
