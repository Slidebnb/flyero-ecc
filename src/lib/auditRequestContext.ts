import { randomUUID } from "node:crypto";
import type { AuditRequestContext } from "@/lib/audit";

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;
const MAX_USER_AGENT_LENGTH = 512;

function firstForwardedValue(value: string | null) {
  if (!value) return null;
  const candidate = value.split(",", 1)[0]?.trim() ?? "";
  return candidate.length > 0 && candidate.length <= 128 ? candidate : null;
}

export function auditRequestContext(request: Request): AuditRequestContext {
  const suppliedRequestId = request.headers.get("x-request-id")?.trim() ?? "";
  const requestId = REQUEST_ID_PATTERN.test(suppliedRequestId) ? suppliedRequestId : randomUUID();
  const ipAddress = firstForwardedValue(request.headers.get("x-forwarded-for"))
    ?? firstForwardedValue(request.headers.get("x-real-ip"));
  const userAgent = request.headers.get("user-agent")?.slice(0, MAX_USER_AGENT_LENGTH) || null;

  return { requestId, ipAddress, userAgent };
}
