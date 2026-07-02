import { DistributionAreaType, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createDistributionArea, listAreas } from "@/lib/areas";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";
import { areaSchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER, UserRole.CUSTOMER]);
    const url = new URL(request.url);
    const type = url.searchParams.get("type") as DistributionAreaType | null;
    const areas = await listAreas({
      search: url.searchParams.get("search") || undefined,
      city: url.searchParams.get("city") || undefined,
      type: type || undefined,
      includeDeleted: url.searchParams.get("includeDeleted") === "true",
    });

    return Response.json({ ok: true, data: areas });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER, UserRole.CUSTOMER]);
    const parsed = areaSchema.safeParse(await readBody(request));

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    }

    const customer = session.role === "CUSTOMER"
      ? await prisma.customerProfile.findUnique({ where: { userId: session.id }, select: { id: true } })
      : null;
    const area = await createDistributionArea({
      ...parsed.data,
      userId: session.id,
      customerId: customer?.id ?? null,
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
