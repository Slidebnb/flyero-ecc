import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRole([UserRole.ADMIN]);
    const { id } = await context.params;
    const accountingExport = await prisma.accountingExport.findUnique({
      where: { id },
      include: { createdBy: { select: { email: true } }, items: { orderBy: { createdAt: "asc" } } },
    });
    if (!accountingExport) throw new Error("Export wurde nicht gefunden.");
    return successResponse(accountingExport);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
