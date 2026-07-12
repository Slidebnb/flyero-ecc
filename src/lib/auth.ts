import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

const DEFAULT_COOKIE_NAME = "ecc_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  warehouseId?: string | null;
  tenantId?: string | null;
};

export type SessionPayload = SessionUser & {
  exp: number;
  sessionId: string;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status = 401,
  ) {
    super(message);
  }
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET muss mindestens 32 Zeichen lang sein.");
  }

  return new TextEncoder().encode(secret);
}

export function getSessionCookieName() {
  return process.env.AUTH_COOKIE_NAME || DEFAULT_COOKIE_NAME;
}

export async function createSessionToken(user: SessionUser, sessionId = randomUUID()) {
  return new SignJWT({ ...user, sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getAuthSecret());
}

export async function setSessionCookie(user: SessionUser, request?: Request) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const forwardedFor = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipAddress = forwardedFor || request?.headers.get("x-real-ip") || null;
  const userAgent = request?.headers.get("user-agent")?.slice(0, 512) || null;

  await prisma.authSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  let token: string;
  try {
    token = await createSessionToken(user, sessionId);
  } catch (error) {
    await prisma.authSession.delete({ where: { id: sessionId } });
    throw error;
  }

  const cookieStore = await cookies();

  cookieStore.set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(getSessionCookieName());
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;

  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, getAuthSecret());
    const sessionId = verified.payload.sessionId;
    if (typeof sessionId !== "string") return null;

    const authSession = await prisma.authSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        lastSeenAt: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            warehouseId: true,
            tenantId: true,
            status: true,
          },
        },
      },
    });

    if (
      !authSession ||
      authSession.revokedAt ||
      authSession.expiresAt <= new Date() ||
      authSession.user.status !== "ACTIVE"
    ) {
      return null;
    }

    const now = new Date();
    if (!authSession.lastSeenAt || now.getTime() - authSession.lastSeenAt.getTime() >= 5 * 60 * 1000) {
      await prisma.authSession.updateMany({
        where: { id: authSession.id, revokedAt: null },
        data: { lastSeenAt: now },
      });
    }

    return {
      id: authSession.user.id,
      email: authSession.user.email,
      role: authSession.user.role,
      warehouseId: authSession.user.warehouseId,
      tenantId: authSession.user.tenantId,
      sessionId: authSession.id,
      exp: typeof verified.payload.exp === "number" ? verified.payload.exp : Math.floor(authSession.expiresAt.getTime() / 1000),
    };
  } catch {
    return null;
  }
}

export async function revokeSession(sessionId: string) {
  await prisma.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function hasRole(session: SessionPayload | null, roles: UserRole[]) {
  return Boolean(session && roles.includes(session.role));
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    throw new AuthError("Nicht angemeldet.", 401);
  }

  return session;
}

export async function requireRole(roles: UserRole[]) {
  const session = await requireSession();

  if (!roles.includes(session.role)) {
    throw new AuthError("Keine Berechtigung für diese Aktion.", 403);
  }

  return session;
}

export function createVerificationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
