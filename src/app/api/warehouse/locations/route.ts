import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { warehouseScopeForUser } from "@/lib/logistics";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { warehouseLocationCreateSchema } from "@/lib/validators";

export async function GET() {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_OPERATIONS_VIEW);
    const locations = await prisma.warehouseLocation.findMany({
      where: { warehouse: warehouseScopeForUser(session) },
      include: { warehouse: true },
      orderBy: [{ warehouseId: "asc" }, { fullLabel: "asc" }],
    });
    return Response.json({ ok: true, data: locations });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_OPERATIONS_MANAGE);
    const parsed = warehouseLocationCreateSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    if (session.role === UserRole.WAREHOUSE_STAFF && session.warehouseId !== parsed.data.warehouseId) {
      return errorResponse("Dieses Lager ist deinem Zugang nicht zugeordnet.", 403);
    }
    const fullLabel = `${parsed.data.aisle}-${parsed.data.shelf}-${parsed.data.compartment}`;
    const location = await prisma.warehouseLocation.create({
      data: { ...parsed.data, fullLabel },
    });
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL("/warehouse/locations", request.url), { status: 303 });
    }
    return Response.json({ ok: true, data: location }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
