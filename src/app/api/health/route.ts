import { HealthStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
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
