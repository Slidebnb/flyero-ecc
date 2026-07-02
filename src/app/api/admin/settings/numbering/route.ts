import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { getNumberingSettings, updateNumberingSettings } from "@/lib/settings";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN]);
    return successResponse(await getNumberingSettings());
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const body = await readBody(request) as Record<string, unknown>;
    const data = {
      invoicePrefix: String(body.invoicePrefix ?? "").trim(),
      invoiceYear: Number(body.invoiceYear),
      invoiceNextNumber: Number(body.invoiceNextNumber),
      reportPrefix: String(body.reportPrefix ?? "").trim(),
      reportYear: Number(body.reportYear),
      reportNextNumber: Number(body.reportNextNumber),
      orderPrefix: String(body.orderPrefix ?? "").trim(),
      orderYear: Number(body.orderYear),
      orderNextNumber: Number(body.orderNextNumber),
    };
    return successResponse(await updateNumberingSettings(data, session.id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
