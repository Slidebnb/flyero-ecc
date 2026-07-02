import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { createInvoiceForOrder } from "@/lib/invoices";
import { logBackgroundJobFailure, logBackgroundJobStart, logBackgroundJobSuccess } from "@/lib/monitoring";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  let jobId: string | null = null;
  try {
    const token = request.headers.get("x-internal-token");
    let adminUserId: string | null = null;
    if (process.env.INTERNAL_API_TOKEN && token === process.env.INTERNAL_API_TOKEN) {
      adminUserId = null;
    } else {
      const session = await requireRole([UserRole.ADMIN]);
      adminUserId = session.id;
    }
    const { id } = await context.params;
    const job = await logBackgroundJobStart("PDF_GENERATION", { orderId: id, invoice: true });
    jobId = job.id;
    const invoice = await createInvoiceForOrder({ orderId: id, adminUserId });
    await logBackgroundJobSuccess(job.id, { orderId: id, invoiceId: invoice.id });
    return Response.json({ ok: true, data: invoice });
  } catch (error) {
    if (jobId) await logBackgroundJobFailure(jobId, error);
    if (error instanceof Error && error.message.includes("Nicht angemeldet")) {
      return errorResponse("Interner Zugriff nicht erlaubt.", 403);
    }
    return routeErrorResponse(error);
  }
}
