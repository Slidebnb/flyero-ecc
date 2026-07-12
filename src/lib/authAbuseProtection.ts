import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type AuthRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type AuthRateLimitScope = "login" | "register" | "resend" | "verify";

type BucketSettings = {
  suffix: string;
  maxAttempts: number;
  windowMs: number;
  value: string;
};

function positiveEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function hashedBucketId(scope: AuthRateLimitScope, suffix: string, value: string) {
  return createHash("sha256")
    .update(`flyero-auth-rate-limit:${scope}:${suffix}:${value}`)
    .digest("hex");
}

function settingsFor(scope: AuthRateLimitScope, request: Request, identity?: string): BucketSettings[] {
  const ip = clientIp(request);
  if (scope === "login") {
    const settings: BucketSettings[] = [
      {
        suffix: "ip",
        value: ip,
        maxAttempts: positiveEnv("AUTH_LOGIN_IP_RATE_LIMIT_MAX", 10),
        windowMs: positiveEnv("AUTH_LOGIN_IP_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
      },
    ];
    if (identity?.trim()) {
      settings.push({
        suffix: "account",
        value: identity.trim().toLowerCase(),
        maxAttempts: positiveEnv("AUTH_LOGIN_ACCOUNT_RATE_LIMIT_MAX", 5),
        windowMs: positiveEnv("AUTH_LOGIN_ACCOUNT_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
      });
    }
    return settings;
  }

  const config = {
    register: ["AUTH_REGISTER_IP_RATE_LIMIT_MAX", "AUTH_REGISTER_IP_RATE_LIMIT_WINDOW_MS", 5, 60 * 60 * 1000],
    resend: ["AUTH_RESEND_IP_RATE_LIMIT_MAX", "AUTH_RESEND_IP_RATE_LIMIT_WINDOW_MS", 3, 60 * 60 * 1000],
    verify: ["AUTH_VERIFY_IP_RATE_LIMIT_MAX", "AUTH_VERIFY_IP_RATE_LIMIT_WINDOW_MS", 10, 15 * 60 * 1000],
  }[scope] as [string, string, number, number];

  return [{
    suffix: identity?.trim() ? "ip-account" : "ip",
    value: identity?.trim() ? `${ip}:${identity.trim().toLowerCase()}` : ip,
    maxAttempts: positiveEnv(config[0], config[2]),
    windowMs: positiveEnv(config[1], config[3]),
  }];
}

async function consumeBucket(settings: BucketSettings, scope: AuthRateLimitScope): Promise<AuthRateLimitDecision> {
  const id = hashedBucketId(scope, settings.suffix, settings.value);
  const now = new Date();
  const current = await prisma.authRateLimitBucket.findUnique({ where: { id } });
  const windowExpired = !current || current.windowStartedAt.getTime() + settings.windowMs <= now.getTime();

  if (windowExpired) {
    await prisma.authRateLimitBucket.upsert({
      where: { id },
      create: { id, windowStartedAt: now, attempts: 1 },
      update: { windowStartedAt: now, attempts: 1, blockedUntil: null },
    });
    return { allowed: true };
  }

  if (current.blockedUntil && current.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(Math.ceil((current.blockedUntil.getTime() - now.getTime()) / 1000), 1),
    };
  }

  if (current.attempts >= settings.maxAttempts) {
    const blockedUntil = new Date(now.getTime() + settings.windowMs);
    await prisma.authRateLimitBucket.update({ where: { id }, data: { blockedUntil } });
    return { allowed: false, retryAfterSeconds: Math.max(Math.ceil(settings.windowMs / 1000), 1) };
  }

  await prisma.authRateLimitBucket.update({
    where: { id },
    data: { attempts: { increment: 1 } },
  });
  return { allowed: true };
}

export async function enforceAuthRateLimit(
  request: Request,
  scope: AuthRateLimitScope,
  identity?: string,
): Promise<AuthRateLimitDecision> {
  for (const settings of settingsFor(scope, request, identity)) {
    const decision = await consumeBucket(settings, scope);
    if (!decision.allowed) return decision;
  }
  return { allowed: true };
}

export function authRateLimitResponse(decision: Extract<AuthRateLimitDecision, { allowed: false }>) {
  return Response.json(
    { ok: false, error: "Zu viele Versuche. Bitte später erneut versuchen." },
    { status: 429, headers: { "retry-after": String(decision.retryAfterSeconds) } },
  );
}
