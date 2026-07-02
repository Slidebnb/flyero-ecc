import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth";

export async function readBody(request: NextRequest) {
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

  throw error;
}
