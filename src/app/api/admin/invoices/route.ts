import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN]);
    const invoices = await prisma.invoice.findMany({
      include: { customer: true, order: true, payment: true, items: true, creditNotes: true },
      orderBy: { invoiceDate: "desc" },
    });
    return Response.json({ ok: true, data: invoices });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
