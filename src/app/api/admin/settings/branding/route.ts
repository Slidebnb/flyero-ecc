import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { getBrandingSettings, updateBrandingSettings } from "@/lib/settings";

const FIELDS = ["primaryColor", "secondaryColor", "accentColor", "logoUrl", "reportFooterText", "invoiceFooterText"];

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN]);
    return successResponse(await getBrandingSettings());
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const body = await readBody(request) as Record<string, unknown>;
    const data = Object.fromEntries(FIELDS.map((field) => [field, String(body[field] ?? "").trim()]));
    return successResponse(await updateBrandingSettings(data, session.id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
