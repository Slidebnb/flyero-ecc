import { readFile } from "node:fs/promises";
import path from "node:path";
import { UserRole } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const { id } = await context.params;
    const accountingExport = await prisma.accountingExport.findUnique({ where: { id } });
    if (!accountingExport?.fileUrl) throw new Error("Exportdatei wurde nicht gefunden.");
    const filePath = path.join(process.cwd(), "public", accountingExport.fileUrl.replace(/^\/+/, ""));
    const file = await readFile(filePath);
    await createAuditLog({ userId: session.id, action: "accounting.export_downloaded", entityType: "AccountingExport", entityId: accountingExport.id });
    return new Response(file, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="flyero-accounting-export-${accountingExport.exportNumber}.csv"`,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
