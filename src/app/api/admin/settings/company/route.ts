import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { getCompanySettings, updateCompanySettings } from "@/lib/settings";

const FIELDS = ["companyName", "legalName", "street", "postalCode", "city", "country", "phone", "email", "website", "taxNumber", "vatId", "bankName", "iban", "bic", "logoUrl"];

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN]);
    return successResponse(await getCompanySettings());
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const body = await readBody(request) as Record<string, unknown>;
    const data = Object.fromEntries(FIELDS.map((field) => [field, String(body[field] ?? "").trim()]));
    return successResponse(await updateCompanySettings(data, session.id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
