import { LeadStatus, LeadType, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET(request: NextRequest) {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const type = params.get("type");
    const archived = params.get("archived");
    const search = params.get("search")?.trim();

    const leads = await prisma.lead.findMany({
      where: {
        ...(status && Object.values(LeadStatus).includes(status as LeadStatus) ? { status: status as LeadStatus } : {}),
        ...(type && Object.values(LeadType).includes(type as LeadType) ? { type: type as LeadType } : {}),
        ...(archived === "true" ? { archivedAt: { not: null } } : archived === "all" ? {} : { archivedAt: null }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { companyName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { city: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return successResponse(leads);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
