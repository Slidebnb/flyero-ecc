import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth";

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim();
  if (!origin || origin === "null") return;

  const allowedOrigins = new Set<string>();
  try {
    allowedOrigins.add(new URL(request.url).origin);
  } catch {
    throw new AuthError("Ungültige Anfrageherkunft.", 403);
  }

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL;
  if (configuredSiteUrl) {
    try {
      allowedOrigins.add(new URL(configuredSiteUrl).origin);
    } catch {
      // Eine fehlerhafte optionale Site-URL darf die lokale Request-Prüfung nicht aushebeln.
    }
  }

  if (!allowedOrigins.has(origin)) {
    throw new AuthError("Anfrageherkunft nicht erlaubt.", 403);
  }
}

export async function readBody(request: NextRequest) {
  assertSameOrigin(request);
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  const formData = await request.formData();
  const body: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};

  for (const [key, value] of formData.entries()) {
    const existing = body[key];

    if (Array.isArray(existing)) {
      existing.push(value);
    } else if (existing) {
      body[key] = [existing, value];
    } else {
      body[key] = value;
    }
  }

  return body;
}

export function errorResponse(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

export function successResponse<T>(data: T, status = 200) {
  return Response.json({ ok: true, data }, { status });
}

export function routeErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return errorResponse(error.message, error.status);
  }

  if (error instanceof Error && (error as Error & { code?: string }).code === "ORDER_INTEGRITY_FAILED") {
    return Response.json({ ok: false, code: "ORDER_INTEGRITY_FAILED", error: "Die Kampagne konnte nicht freigegeben werden, weil gespeicherte Gebiets- oder Preisdaten nicht mehr zusammenpassen. Bitte lasse sie durch FLYERO prüfen." }, { status: 409 });
  }

  throw error;
}
