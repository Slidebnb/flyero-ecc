import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  copyDistributionArea,
  deleteDistributionArea,
  notifyAreaChangedForCustomers,
  updateDistributionArea,
} from "@/lib/areas";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { areaSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function updateAreaFromBody(input: {
  body: Record<string, unknown>;
  id: string;
  userId: string;
}) {
  const action = typeof input.body.action === "string" ? input.body.action : undefined;

  if (action === "copy") {
    return copyDistributionArea({ id: input.id, userId: input.userId });
  }

  const parsed = areaSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
  }

  const area = await updateDistributionArea({ id: input.id, userId: input.userId, ...parsed.data });
  await notifyAreaChangedForCustomers(area.id, "updated");
  return area;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const body = await readBody(request) as Record<string, unknown>;
    const area = await updateAreaFromBody({ body, id, userId: session.id });

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL("/admin/areas", request.url), { status: 303 });
    }

    return Response.json({ ok: true, data: area });
  } catch (error) {
    try {
      return routeErrorResponse(error);
    } catch {
      return errorResponse(error instanceof Error ? error.message : "Gebiet konnte nicht aktualisiert werden.", 400);
    }
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const area = await deleteDistributionArea({ id, userId: session.id });
    await notifyAreaChangedForCustomers(area.id, "deleted");
    return Response.json({ ok: true, data: area });
  } catch (error) {
    try {
      return routeErrorResponse(error);
    } catch {
      return errorResponse(error instanceof Error ? error.message : "Gebiet konnte nicht gelöscht werden.", 400);
    }
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const body = await readBody(request) as Record<string, unknown>;
  const method = typeof body._method === "string" ? body._method.toUpperCase() : "";
  if (method === "DELETE") {
    try {
      const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
      const { id } = await context.params;
      const area = await deleteDistributionArea({ id, userId: session.id });
      await notifyAreaChangedForCustomers(area.id, "deleted");
      return NextResponse.redirect(new URL("/admin/areas", request.url), { status: 303 });
    } catch (error) {
      try {
        return routeErrorResponse(error);
      } catch {
        return errorResponse(error instanceof Error ? error.message : "Gebiet konnte nicht gelöscht werden.", 400);
      }
    }
  }
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    await updateAreaFromBody({ body, id, userId: session.id });
    return NextResponse.redirect(new URL("/admin/areas", request.url), { status: 303 });
  } catch (error) {
    try {
      return routeErrorResponse(error);
    } catch {
      return errorResponse(error instanceof Error ? error.message : "Gebiet konnte nicht aktualisiert werden.", 400);
    }
  }
}
