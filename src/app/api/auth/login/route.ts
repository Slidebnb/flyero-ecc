import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth";
import { readBody, errorResponse } from "@/lib/request";
import { loginSchema } from "@/lib/validators";
import { createAuditLog } from "@/lib/audit";
import { ROLE_HOME } from "@/lib/constants";
import { publicUrl } from "@/lib/publicUrl";

function safeNext(value: unknown) {
  if (typeof value !== "string") return "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "";
}

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  const parsed = loginSchema.safeParse(body);
  const next = safeNext((body as Record<string, unknown>).next || request.nextUrl.searchParams.get("next"));

  if (!parsed.success) {
    return errorResponse("E-Mail oder Passwort ist ungültig.");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      role: true,
      status: true,
      warehouseId: true,
    },
  });

  const passwordIsValid = user
    ? await bcrypt.compare(parsed.data.password, user.passwordHash)
    : false;

  if (!user || !passwordIsValid) {
    return errorResponse("E-Mail oder Passwort ist ungültig.", 401);
  }

  if (user.status === "DISABLED" || user.status === "BANNED") {
    return errorResponse("Dieser Zugang ist deaktiviert.", 403);
  }

  if (user.status === "EMAIL_UNVERIFIED") {
    return errorResponse("Bitte bestätige zuerst deine E-Mail-Adresse.", 403);
  }

  await setSessionCookie({ id: user.id, email: user.email, role: user.role, warehouseId: user.warehouseId });
  await createAuditLog({
    userId: user.id,
    action: "auth.login",
    entityType: "User",
    entityId: user.id,
    newValues: { role: user.role, status: user.status },
  });

  if (request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(publicUrl(next || ROLE_HOME[user.role], request.url), {
      status: 303,
    });
  }

  return Response.json({
    ok: true,
    data: {
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      warehouseId: user.warehouseId,
      redirectTo: next || ROLE_HOME[user.role],
    },
  });
}
