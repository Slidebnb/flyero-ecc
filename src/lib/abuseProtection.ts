import type { NextRequest } from "next/server";
import { enforcePublicRateLimit } from "@/lib/publicAbuseProtection";

type LeadSubmissionDecision =
  | { allowed: true }
  | { allowed: false; reason: "honeypot" }
  | { allowed: false; reason: "rate_limited"; retryAfterSeconds: number };

function textValue(body: unknown, key: string) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const value = (body as Record<string, unknown>)[key];
  if (Array.isArray(value)) return String(value[0] ?? "");
  return typeof value === "string" ? value : "";
}

export async function assertLeadSubmissionAllowed(request: NextRequest, body: unknown): Promise<LeadSubmissionDecision> {
  const honeypot = textValue(body, "website");
  if (honeypot.trim()) return { allowed: false, reason: "honeypot" };
  const decision = await enforcePublicRateLimit(request, "lead");
  return decision.allowed ? decision : { allowed: false, reason: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds };
}
