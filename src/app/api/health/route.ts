import { HealthStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Selecting current schema fields makes an unapplied migration fail closed
    // instead of reporting a stale monitoring row as a healthy application.
    await Promise.all([
      prisma.auditLog.findFirst({ select: { id: true, integrityHash: true }, take: 1 }),
      prisma.warehouse.findFirst({ select: { id: true, isDemoData: true }, take: 1 }),
      prisma.pricingRule.findFirst({ select: { id: true, pricingVersion: true }, take: 1 }),
    ]);
    const latest = await prisma.systemHealthCheck.findFirst({
      orderBy: { checkedAt: "desc" },
      select: { status: true },
    });

    const status = latest?.status ?? HealthStatus.DEGRADED;
    return Response.json({ status }, {
      status: status === HealthStatus.DOWN ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ status: HealthStatus.DOWN }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
