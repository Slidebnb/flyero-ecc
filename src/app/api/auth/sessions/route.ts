import { NextRequest, NextResponse } from "next/server";
import { requireSession, listUserSessions, revokeOtherSessions } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { auditRequestContext } from "@/lib/auditRequestContext";
import { publicUrl } from "@/lib/publicUrl";
import { routeErrorResponse } from "@/lib/request";

export async function GET() {
  try {
    const session = await requireSession();
    return Response.json(
      { ok: true, data: await listUserSessions(session.id, session.sessionId) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const result = await revokeOtherSessions(session.id, session.sessionId);
    await createAuditLog({
      userId: session.id,
      action: "auth.sessions_revoked",
      entityType: "User",
      entityId: session.id,
      newValues: { revokedCount: result.count },
      requestContext: auditRequestContext(request),
      result: "SUCCESS",
    });

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(publicUrl("/customer/profile", request.url), { status: 303 });
    }

    return Response.json(
      { ok: true, data: { revokedCount: result.count } },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
