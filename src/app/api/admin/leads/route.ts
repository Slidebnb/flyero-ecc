import { LeadStatus, LeadType } from "@prisma/client";
import { NextRequest } from "next/server";
import { leadScopeFromSession, leadScopeWhere } from "@/lib/leadScope";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";
import { productionLeadWhere } from "@/lib/productionData";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.CRM_VIEW);
    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const type = params.get("type");
    const archived = params.get("archived");
    const search = params.get("search")?.trim();

    const leads = await prisma.lead.findMany({
      where: {
        ...productionLeadWhere(),
        ...leadScopeWhere(leadScopeFromSession(session)),
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
