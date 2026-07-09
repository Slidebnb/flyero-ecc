import { UserRole } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { readGeneratedAsset } from "@/lib/generatedAssets";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

function metadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const roleAwareWhere =
      session.role === UserRole.ADMIN || session.role === UserRole.SUPPORT_DISPATCHER
        ? { id }
        : session.role === UserRole.CUSTOMER
          ? { id, order: { customer: { userId: session.id } } }
          : session.role === UserRole.DISTRIBUTOR
            ? { id, tour: { distributor: { userId: session.id } } }
            : null;
    if (!roleAwareWhere) return errorResponse("Keine Berechtigung fuer diesen Nachweis.", 403);

    const photo = await prisma.photoProof.findFirst({ where: roleAwareWhere });
    if (!photo) return errorResponse("Nachweisfoto wurde nicht gefunden.", 404);

    const storagePath = metadataValue(photo.metadata, "storagePath");
    const mimeType = metadataValue(photo.metadata, "mimeType") || "image/png";
    if (!storagePath) return errorResponse("Legacy-Foto ohne privaten Speicherpfad kann nicht ausgeliefert werden.", 410);

    const asset = await readGeneratedAsset(storagePath);
    return new Response(asset.buffer, {
      headers: {
        "content-type": mimeType,
        "cache-control": "private, max-age=60",
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
