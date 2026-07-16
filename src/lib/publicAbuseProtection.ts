import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type PublicRateLimitScope =
  | "lead"
  | "report-verify"
  | "maps-autocomplete"
  | "maps-geocode"
  | "maps-intelligence"
  | "client-error"
  | "public-planner-autocomplete"
  | "public-planner-geocode"
  | "public-planner-quote"
  | "public-experience";

type PublicRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

const defaults: Record<PublicRateLimitScope, { maxAttempts: number; windowMs: number }> = {
  lead: { maxAttempts: 5, windowMs: 10 * 60 * 1000 },
  "report-verify": { maxAttempts: 30, windowMs: 15 * 60 * 1000 },
  "maps-autocomplete": { maxAttempts: 60, windowMs: 15 * 60 * 1000 },
  "maps-geocode": { maxAttempts: 30, windowMs: 15 * 60 * 1000 },
  "maps-intelligence": { maxAttempts: 120, windowMs: 15 * 60 * 1000 },
  "client-error": { maxAttempts: 30, windowMs: 15 * 60 * 1000 },
  "public-planner-autocomplete": { maxAttempts: 60, windowMs: 15 * 60 * 1000 },
  "public-planner-geocode": { maxAttempts: 30, windowMs: 15 * 60 * 1000 },
  "public-planner-quote": { maxAttempts: 120, windowMs: 15 * 60 * 1000 },
  "public-experience": { maxAttempts: 120, windowMs: 60 * 1000 },
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

function bucketId(scope: PublicRateLimitScope, request: Request) {
  return createHash("sha256")
    .update(`flyero-public-rate-limit:${scope}:${clientIp(request)}`)
    .digest("hex");
}

function settingsFor(scope: PublicRateLimitScope) {
  const envPrefix = scope === "lead"
    ? "PUBLIC_LEAD"
    : scope === "report-verify"
      ? "PUBLIC_REPORT_VERIFY"
      : scope === "client-error"
        ? "PUBLIC_CLIENT_ERROR"
        : scope === "public-experience"
          ? "PUBLIC_EXPERIENCE"
          : scope === "maps-autocomplete"
            ? "PUBLIC_MAPS_AUTOCOMPLETE"
            : scope === "maps-geocode"
              ? "PUBLIC_MAPS_GEOCODE"
              : scope === "maps-intelligence"
                ? "PUBLIC_MAPS_INTELLIGENCE"
                : scope === "public-planner-autocomplete"
                  ? "PUBLIC_PLANNER_AUTOCOMPLETE"
                  : scope === "public-planner-geocode"
                    ? "PUBLIC_PLANNER_GEOCODE"
                    : "PUBLIC_PLANNER_QUOTE";
  const fallback = defaults[scope];
  return {
    maxAttempts: positiveEnv(`${envPrefix}_RATE_LIMIT_MAX`, fallback.maxAttempts),
    windowMs: positiveEnv(`${envPrefix}_RATE_LIMIT_WINDOW_MS`, fallback.windowMs),
  };
}

export async function enforcePublicRateLimit(
  request: Request,
  scope: PublicRateLimitScope,
): Promise<PublicRateLimitDecision> {
  const settings = settingsFor(scope);
  const id = bucketId(scope, request);
  const now = new Date();
  const current = await prisma.publicRateLimitBucket.findUnique({ where: { id } });

  if (!current || current.windowStartedAt.getTime() + settings.windowMs <= now.getTime()) {
    await prisma.publicRateLimitBucket.upsert({
      where: { id },
      create: { id, scope, windowStartedAt: now, attempts: 1 },
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
    await prisma.publicRateLimitBucket.update({ where: { id }, data: { blockedUntil } });
    return { allowed: false, retryAfterSeconds: Math.max(Math.ceil(settings.windowMs / 1000), 1) };
  }

  await prisma.publicRateLimitBucket.update({
    where: { id },
    data: { attempts: { increment: 1 } },
  });
  return { allowed: true };
}

export function publicRateLimitResponse(decision: Extract<PublicRateLimitDecision, { allowed: false }>) {
  return Response.json(
    { ok: false, error: "Zu viele Anfragen. Bitte versuche es später erneut." },
    { status: 429, headers: { "retry-after": String(decision.retryAfterSeconds) } },
  );
}
