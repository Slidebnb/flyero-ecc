import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function decimalEqual(left, right) {
  return String(left ?? "") === String(right ?? "");
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

const limit = Number(process.env.INTEGRITY_AUDIT_LIMIT || 100);
const orders = await prisma.order.findMany({
  where: { NOT: { orderNumber: { startsWith: "DEMO-" } } },
  orderBy: { createdAt: "asc" },
  take: Number.isFinite(limit) && limit > 0 ? limit : 100,
  select: {
    id: true,
    orderNumber: true,
    status: true,
    flyerQuantity: true,
    calculatedNetPrice: true,
    calculatedVat: true,
    calculatedGrossPrice: true,
    targetAreaGeoJson: true,
    priceRuleSnapshot: true,
    payments: { where: { status: "PAID" }, select: { amount: true } },
    distributionSegments: { select: { flyerQuantity: true } },
  },
});

const findings = [];
for (const order of orders) {
  const snapshot = record(order.priceRuleSnapshot);
  const quote = record(record(snapshot.areaCalculationSnapshot).quote ?? snapshot.quote);
  const segmentFlyers = order.distributionSegments.reduce((sum, segment) => sum + (segment.flyerQuantity ?? 0), 0);
  const checks = {
    quoteFingerprint: typeof quote.fingerprint === "string" && quote.fingerprint.length > 0,
    quoteFlyerQuantity: Number(quote.flyerQuantity) === order.flyerQuantity,
    snapshotNet: decimalEqual(snapshot.calculatedNet, order.calculatedNetPrice),
    snapshotGross: decimalEqual(snapshot.calculatedGross, order.calculatedGrossPrice),
    paidAmount: order.payments.length === 0 || order.payments.every((payment) => decimalEqual(payment.amount, order.calculatedGrossPrice)),
    segmentFlyers: segmentFlyers === 0 || segmentFlyers <= order.flyerQuantity,
    targetSnapshot: Boolean(order.targetAreaGeoJson),
  };
  const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
  if (failed.length > 0) findings.push({ orderId: order.id, orderNumber: order.orderNumber, status: order.status, failed });
}

console.log(JSON.stringify({ scanned: orders.length, findings, readOnly: true }, null, 2));
await prisma.$disconnect();
