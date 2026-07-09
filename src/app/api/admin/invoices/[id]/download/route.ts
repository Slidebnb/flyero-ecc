import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { readGeneratedAsset } from "@/lib/generatedAssets";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice?.pdfUrl) return errorResponse("PDF wurde nicht gefunden.", 404);
    const file = await readGeneratedAsset(invoice.pdfUrl);
    return new Response(file.buffer, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
