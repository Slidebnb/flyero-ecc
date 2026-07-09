import type { NextRequest } from "next/server";

type LeadSubmissionDecision =
  | { allowed: true }
  | { allowed: false; reason: "honeypot" }
  | { allowed: false; reason: "rate_limited"; retryAfterSeconds: number };

type RateBucket = {
  count: number;
  resetAt: number;
};

const leadBuckets = new Map<string, RateBucket>();

function numberFromEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const fingerprint = request.headers.get("user-agent")?.slice(0, 120) || "unknown";
  return `${forwardedFor || realIp || "local"}:${fingerprint}`;
}

function textValue(body: unknown, key: string) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const value = (body as Record<string, unknown>)[key];
  if (Array.isArray(value)) return String(value[0] ?? "");
  return typeof value === "string" ? value : "";
}

function rateLimitLeadSubmission(request: NextRequest): LeadSubmissionDecision {
  const windowMs = numberFromEnv("LEAD_RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000);
  const maxRequests = numberFromEnv("LEAD_RATE_LIMIT_MAX", 5);
  const now = Date.now();
  const key = clientKey(request);
  const existing = leadBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    leadBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  existing.count += 1;
  if (existing.count > maxRequests) {
    return {
      allowed: false,
      reason: "rate_limited",
      retryAfterSeconds: Math.max(Math.ceil((existing.resetAt - now) / 1000), 1),
    };
  }

  return { allowed: true };
}

export function assertLeadSubmissionAllowed(request: NextRequest, body: unknown): LeadSubmissionDecision {
  const honeypot = textValue(body, "website");
  if (honeypot.trim()) return { allowed: false, reason: "honeypot" };
  return rateLimitLeadSubmission(request);
}
