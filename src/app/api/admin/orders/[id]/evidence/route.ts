import { NextRequest, NextResponse } from "next/server";
import { uploadExternalEvidence } from "@/lib/externalEvidence";
import { Permission, requirePermission } from "@/lib/permissions";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

async function fileFromForm(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Bitte eine Datei hochladen.");
  return {
    originalFilename: file.name,
    mimeType: file.type || "application/octet-stream",
    buffer: Buffer.from(await file.arrayBuffer()),
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requirePermission(Permission.DOCUMENT_REVIEW);
    const { id } = await context.params;
    const formData = await request.formData();
    const document = await uploadExternalEvidence({
      actor,
      orderId: id,
      payload: Object.fromEntries(formData.entries()),
      file: await fileFromForm(formData),
    });
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/admin/orders/${id}`, request.url), { status: 303 });
    }
    return Response.json({ ok: true, data: document });
  } catch (error) {
    try {
      return routeErrorResponse(error);
    } catch {
      return errorResponse(error instanceof Error ? error.message : "Nachweis konnte nicht hochgeladen werden.", 400);
    }
  }
}
