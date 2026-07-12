import { requireTenantSession } from "@/lib/tenant";
import { readStoredDocument } from "@/lib/documentStorage";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string; documentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireTenantSession();
    const { id, documentId } = await context.params;
    const report = await prisma.report.findFirst({
      where: {
        id,
        tenantId: session.tenantId,
        status: "PUBLISHED",
        order: { customer: { userId: session.id, tenantId: session.tenantId }, tenantId: session.tenantId },
      },
      select: { orderId: true },
    });
    if (!report) return errorResponse("Bericht wurde nicht gefunden.", 404);
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        orderId: report.orderId,
        tenantId: session.tenantId,
        customerVisible: true,
        status: "APPROVED",
      },
    });
    if (!document) return errorResponse("Nachweis wurde nicht gefunden oder ist nicht freigegeben.", 404);
    const file = await readStoredDocument(document.storedFilename);
    return new Response(file.buffer, {
      headers: {
        "content-type": document.mimeType,
        "content-disposition": `attachment; filename="${document.originalFilename}"`,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
