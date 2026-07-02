import { NextRequest } from "next/server";
import { AccountingExportFormat, AccountingExportType, UserRole } from "@prisma/client";
import { createAccountingExport } from "@/lib/accountingExport";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

export async function GET(request: NextRequest) {
  try {
    await requireRole([UserRole.ADMIN]);
    const url = new URL(request.url);
    const exports = await prisma.accountingExport.findMany({
      where: {
        ...(url.searchParams.get("status") ? { status: url.searchParams.get("status") as never } : {}),
        ...(url.searchParams.get("type") ? { type: url.searchParams.get("type") as never } : {}),
      },
      include: { createdBy: { select: { email: true } }, items: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return successResponse(exports);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const body = await readBody(request) as Record<string, unknown>;
    const periodStart = new Date(String(body.periodStart));
    const periodEnd = new Date(String(body.periodEnd));
    periodEnd.setHours(23, 59, 59, 999);
    const created = await createAccountingExport({
      type: String(body.type ?? AccountingExportType.FULL_ACCOUNTING) as AccountingExportType,
      format: String(body.format ?? AccountingExportFormat.CSV_GENERIC) as AccountingExportFormat,
      periodStart,
      periodEnd,
      createdById: session.id,
    });
    return successResponse(created, 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
