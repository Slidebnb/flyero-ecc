import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getSession, revokeSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { publicUrl } from "@/lib/publicUrl";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (session) await revokeSession(session.sessionId);
  await clearSessionCookie();

  if (session) {
    await createAuditLog({
      userId: session.id,
      action: "auth.logout",
      entityType: "User",
      entityId: session.id,
    });
  }

  if (request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(publicUrl("/login", request.url), { status: 303 });
  }

  return Response.json({ ok: true });
}
