import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { ROLE_HOME } from "@/lib/constants";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "ecc_session";

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

export async function proxy(request: NextRequest) {
  const protectedRoute = PROTECTED_PREFIXES.find(({ prefix }) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (!protectedRoute) {
    return NextResponse.next();
  }

  const role = await getRoleFromRequest(request);

  if (!role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!protectedRoute.roles.includes(role)) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/customer/:path*", "/distributor/:path*", "/warehouse/:path*", "/admin/:path*"],
};
