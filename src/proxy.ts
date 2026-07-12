import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { ROLE_HOME } from "@/lib/constants";
import { publicUrl } from "@/lib/publicUrl";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "ecc_session";
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

const PROTECTED_PREFIXES: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/customer", roles: ["CUSTOMER"] },
  { prefix: "/distributor", roles: ["DISTRIBUTOR"] },
  { prefix: "/warehouse", roles: ["WAREHOUSE_STAFF"] },
  { prefix: "/admin", roles: ["ADMIN", "SUPPORT_DISPATCHER"] },
];

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    return null;
  }

  return new TextEncoder().encode(secret);
}

async function getRoleFromRequest(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const secret = getAuthSecret();

  if (!token || !secret) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, secret);
    return verified.payload.role as UserRole | undefined;
  } catch {
    return null;
  }
}

function requestIdFor(request: NextRequest) {
  const supplied = request.headers.get("x-request-id")?.trim() ?? "";
  return REQUEST_ID_PATTERN.test(supplied) ? supplied : crypto.randomUUID();
}

function nextWithRequestId(request: NextRequest, requestId: string) {
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function proxy(request: NextRequest) {
  const requestId = requestIdFor(request);
  const protectedRoute = PROTECTED_PREFIXES.find(({ prefix }) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (!protectedRoute) {
    return nextWithRequestId(request, requestId);
  }

  const role = await getRoleFromRequest(request);

  if (!role) {
    const loginUrl = publicUrl("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (!protectedRoute.roles.includes(role)) {
    const response = NextResponse.redirect(publicUrl(ROLE_HOME[role], request.url));
    response.headers.set("x-request-id", requestId);
    return response;
  }

  return nextWithRequestId(request, requestId);
}

export const config = {
  matcher: ["/api/:path*", "/customer/:path*", "/distributor/:path*", "/warehouse/:path*", "/admin/:path*"],
};
