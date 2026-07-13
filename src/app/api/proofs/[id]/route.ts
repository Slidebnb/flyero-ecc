import { ReviewStatus, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { privateDownloadHeaders, rasterProofMimeType } from "@/lib/downloadHeaders";
import { readGeneratedAsset } from "@/lib/generatedAssets";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { requireActiveTenantMembership, tenantWhereForSession } from "@/lib/tenantPolicy";

type RouteContext = { params: Promise<{ id: string }> };

function metadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER, UserRole.CUSTOMER, UserRole.DISTRIBUTOR]);
    if (session.role === UserRole.SUPPORT_DISPATCHER) await requireActiveTenantMembership(session);
    const { id } = await context.params;
    const roleAwareWhere =
      session.role === UserRole.ADMIN || session.role === UserRole.SUPPORT_DISPATCHER
        ? session.role === UserRole.ADMIN
          ? { id }
          : { id, order: tenantWhereForSession(session) }
          : session.role === UserRole.CUSTOMER
          ? { id, customerVisible: true, reviewStatus: ReviewStatus.APPROVED, order: { customer: { userId: session.id } } }
          : session.role === UserRole.DISTRIBUTOR
            ? { id, tour: { distributor: { userId: session.id } } }
            : null;
    if (!roleAwareWhere) return errorResponse("Keine Berechtigung fuer diesen Nachweis.", 403);

    const photo = await prisma.photoProof.findFirst({ where: roleAwareWhere });
    if (!photo) return errorResponse("Nachweisfoto wurde nicht gefunden.", 404);

    const storagePath = metadataValue(photo.metadata, "storagePath");
    const mimeType = rasterProofMimeType(metadataValue(photo.metadata, "mimeType"));
    if (!storagePath) return errorResponse("Legacy-Foto ohne privaten Speicherpfad kann nicht ausgeliefert werden.", 410);

    const asset = await readGeneratedAsset(storagePath);
    return new Response(asset.buffer, {
      headers: privateDownloadHeaders({ contentType: mimeType, filename: asset.fileName, inline: true }),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
