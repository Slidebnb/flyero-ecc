import { DistributionAreaType, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireTenantSession } from "@/lib/tenant";
import { requireActiveTenantMembership } from "@/lib/tenantPolicy";
import { createDistributionArea, listAreas } from "@/lib/areas";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";
import { areaSchema } from "@/lib/validators";
import { isProductionRuntime } from "@/lib/productionData";

export async function GET(request: Request) {
  try {
    const session = await requireAreaSession();
    const url = new URL(request.url);
    const type = url.searchParams.get("type") as DistributionAreaType | null;
    const areas = await listAreas({
      search: url.searchParams.get("search") || undefined,
      city: url.searchParams.get("city") || undefined,
      type: type || undefined,
      includeDeleted: url.searchParams.get("includeDeleted") === "true",
      tenantId: session.role === UserRole.ADMIN ? undefined : session.tenantId,
    });

    return Response.json({ ok: true, data: areas });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAreaSession();
    const parsed = areaSchema.safeParse(await readBody(request));

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    }
    if (isProductionRuntime && parsed.data.dataSourceType === "SEED") {
      return errorResponse("Seed-/Demo-Gebiete d\u00fcrfen in Produktion nicht angelegt werden.", 422);
    }

    const customer = session.role === "CUSTOMER"
      ? await prisma.customerProfile.findUnique({ where: { userId: session.id }, select: { id: true } })
      : null;
    const area = await createDistributionArea({
      ...parsed.data,
      userId: session.id,
      customerId: customer?.id ?? null,
      tenantId: session.role === UserRole.ADMIN ? null : session.tenantId,
      reusable: session.role === "CUSTOMER" ? false : parsed.data.reusable ?? true,
    });

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL("/admin/areas", request.url), { status: 303 });
    }

    return Response.json({ ok: true, data: area }, { status: 201 });
  } catch (error) {
    try {
      return routeErrorResponse(error);
    } catch {
      return errorResponse(error instanceof Error ? error.message : "Gebiet konnte nicht gespeichert werden.", 400);
    }
  }
}

async function requireAreaSession() {
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER, UserRole.CUSTOMER]);
  if (session.role === UserRole.CUSTOMER) return requireTenantSession();
  if (session.role === UserRole.SUPPORT_DISPATCHER) await requireActiveTenantMembership(session);
  return session;
}
