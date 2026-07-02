import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

const DEFAULT_COOKIE_NAME = "ecc_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  warehouseId?: string | null;
};

export type SessionPayload = SessionUser & {
  exp: number;
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

export async function createSessionToken(user: SessionUser) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getAuthSecret());
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
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
    return verified.payload as SessionPayload;
  } catch {
    return null;
  }
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
    throw new AuthError("Keine Berechtigung fuer diese Aktion.", 403);
  }

  return session;
}

export function createVerificationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
