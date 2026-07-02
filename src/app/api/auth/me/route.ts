import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return Response.json({ ok: false, error: "Nicht angemeldet." }, { status: 401 });
  }

  return Response.json({
    ok: true,
    data: {
      id: session.id,
      email: session.email,
      role: session.role,
    },
  });
}
