import { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/tenant";
import { getDocumentDownload } from "@/lib/documents";
import { routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireTenantSession();
    const { id } = await context.params;
    const version = request.nextUrl.searchParams.get("version");
    const file = await getDocumentDownload(session, id, version ? Number(version) : undefined);
    return new Response(file.buffer, {
      headers: {
        "content-type": file.mimeType,
        "content-length": String(file.size),
        "content-disposition": `attachment; filename="${file.filename.replace(/"/g, "")}"`,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
