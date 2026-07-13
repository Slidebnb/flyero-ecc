import { NextRequest, NextResponse } from "next/server";
import { cancelInvoice, prepareCreditNote } from "@/lib/invoices";
import { Permission, requirePermission } from "@/lib/permissions";
import { readBody, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.INVOICE_MANAGE);
    const { id } = await context.params;
    const body = await readBody(request);
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Storno vorbereitet.";
    const invoice = await cancelInvoice({ invoiceId: id, adminUserId: session.id, reason });
    if (body.prepareCreditNote === "true" || body.prepareCreditNote === true) {
      await prepareCreditNote({ invoiceId: id, adminUserId: session.id, reason });
    }
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/admin/invoices/${id}`, request.url), { status: 303 });
    }
    return Response.json({ ok: true, data: invoice });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
