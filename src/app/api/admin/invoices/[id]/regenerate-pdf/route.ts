import { NextRequest, NextResponse } from "next/server";
import { generateInvoicePdf } from "@/lib/invoices";
import { logBackgroundJobFailure, logBackgroundJobStart, logBackgroundJobSuccess } from "@/lib/monitoring";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  let jobId: string | null = null;
  try {
    const session = await requirePermission(Permission.INVOICE_MANAGE);
    const { id } = await context.params;
    const job = await logBackgroundJobStart("PDF_GENERATION", { invoiceId: id, regenerate: true });
    jobId = job.id;
    const pdf = await generateInvoicePdf(id, { regeneratedById: session.id });
    await logBackgroundJobSuccess(job.id, { invoiceId: id, pdfUrl: pdf.pdfUrl });
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/admin/invoices/${id}`, request.url), { status: 303 });
    }
    return Response.json({ ok: true, data: pdf });
  } catch (error) {
    if (jobId) await logBackgroundJobFailure(jobId, error);
    return routeErrorResponse(error);
  }
}
