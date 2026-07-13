import { Permission, requirePermission } from "@/lib/permissions";
import { readGeneratedAsset } from "@/lib/generatedAssets";
import { scanFileBuffer } from "@/lib/fileScanning";
import { createAuditLog } from "@/lib/audit";
import { routeErrorResponse, successResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";
import { tenantWhereForSession } from "@/lib/tenantPolicy";

type RouteContext = { params: Promise<{ id: string }> };

function metadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.DOCUMENT_SCAN);
    const { id } = await context.params;
    const photo = await prisma.photoProof.findFirst({ where: { id, order: tenantWhereForSession(session) } });
    if (!photo) return Response.json({ ok: false, error: "Nachweisfoto wurde nicht gefunden." }, { status: 404 });
    const storagePath = metadataValue(photo.metadata, "storagePath");
    if (!storagePath) return Response.json({ ok: false, error: "Für dieses Foto ist kein privater Speicherpfad vorhanden." }, { status: 410 });
    const asset = await readGeneratedAsset(storagePath);
    const scan = await scanFileBuffer({ buffer: asset.buffer, originalFilename: asset.fileName });
    const updated = await prisma.photoProof.update({
      where: { id: photo.id },
      data: {
        scanStatus: scan.status,
        scanProvider: scan.provider,
        scanMessage: scan.message,
        scannedAt: new Date(),
        ...(scan.status === "CLEAN" ? {} : { customerVisible: false, reviewStatus: "PENDING" }),
      },
    });
    await createAuditLog({ userId: session.id, action: "photo.scan_completed", entityType: "PhotoProof", entityId: photo.id, newValues: { status: scan.status, provider: scan.provider } });
    return successResponse(updated);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
