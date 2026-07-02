import { HealthStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const latest = await prisma.systemHealthCheck.findFirst({
    orderBy: { checkedAt: "desc" },
    select: { status: true },
  });

  return Response.json({
    status: latest?.status ?? HealthStatus.OK,
  });
}
