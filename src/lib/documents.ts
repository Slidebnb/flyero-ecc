import {
  Prisma,
  UserRole,
} from "@prisma/client";
import type { DocumentStatus, DocumentType, PrintStatus } from "@prisma/client";
import { z } from "zod";
import { AuthError, type SessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { storeDocumentFile, protectedDocumentUrl, type UploadableDocumentFile, readStoredDocument } from "@/lib/documentStorage";
import { assignWarehouseForOrder, createLogisticsShipment, updateLogisticsShipment, warehouseAddressJson } from "@/lib/logistics";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { createOrderStatusEvent } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER];
const DOCUMENT_TYPE_VALUES = ["FLYER_PDF", "PRINT_FILE", "INDESIGN", "ILLUSTRATOR", "LOGO", "IMAGE", "ZIP", "REPORT", "INVOICE", "CONTRACT", "OTHER"] as const;
const DOCUMENT_STATUS_VALUES = ["UPLOADED", "UNDER_REVIEW", "APPROVED", "REJECTED", "ARCHIVED"] as const;
const PRINT_STATUS_VALUES = ["REQUESTED", "APPROVED", "IN_PRODUCTION", "SHIPPED", "DELIVERED", "RECEIVED_IN_WAREHOUSE", "READY_FOR_DISTRIBUTION", "CANCELLED"] as const;
const DOCUMENT_COMMENT_VISIBILITY_VALUES = ["PUBLIC", "INTERNAL"] as const;

export const documentCreateSchema = z.object({
  orderId: z.string().min(1),
  documentType: z.enum(DOCUMENT_TYPE_VALUES).default("OTHER"),
  title: z.string().trim().min(2).max(180),
  originalFilename: z.string().trim().min(3).max(255),
  mimeType: z.string().optional(),
  content: z.string().optional(),
  folderId: z.string().optional(),
});

export const documentUpdateSchema = z.object({
  status: z.enum(DOCUMENT_STATUS_VALUES).optional(),
  title: z.string().trim().min(2).max(180).optional(),
  documentType: z.enum(DOCUMENT_TYPE_VALUES).optional(),
  rejectedReason: z.string().trim().max(2000).nullable().optional(),
});

export const documentCommentSchema = z.object({
  message: z.string().trim().min(2).max(4000),
  visibility: z.enum(DOCUMENT_COMMENT_VISIBILITY_VALUES).default("PUBLIC"),
});

export const printOrderCreateSchema = z.object({
  orderId: z.string().min(1),
  printerId: z.string().optional(),
  printFormat: z.enum(["DIN_A4", "DIN_A5", "DIN_LANG", "SQUARE", "CUSTOM"]),
  paperType: z.string().trim().min(2).max(80),
  paperWeight: z.coerce.number().int().min(60).max(500),
  colorMode: z.enum(["4/4", "4/0", "1/1"]),
  doubleSided: z.coerce.boolean().default(true),
  folded: z.enum(["NONE", "HALF_FOLD", "ROLL_FOLD", "Z_FOLD"]).default("NONE"),
  finishing: z.enum(["NONE", "VARNISH", "MATTE", "GLOSS"]).default("NONE"),
  quantity: z.coerce.number().int().positive(),
  notes: z.string().trim().max(4000).optional(),
});

export const printOrderUpdateSchema = z.object({
  printerId: z.string().nullable().optional(),
  status: z.enum(PRINT_STATUS_VALUES).optional(),
  estimatedDelivery: z.coerce.date().nullable().optional(),
  trackingNumber: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  estimatedNetPrice: z.coerce.number().positive().nullable().optional(),
  estimatedGrossPrice: z.coerce.number().positive().nullable().optional(),
});

export const printPartnerSchema = z.object({
  companyName: z.string().trim().min(2).max(180),
  contactName: z.string().trim().max(180).optional(),
  email: z.string().email(),
  phone: z.string().trim().max(80).optional(),
  address: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  isActive: z.coerce.boolean().default(true),
});

function normalizeAddressJson(address: z.infer<typeof printPartnerSchema>["address"]): Prisma.InputJsonValue {
  if (typeof address === "string") return { raw: address };
  return (address || {}) as Prisma.InputJsonValue;
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  UPLOADED: "Hochgeladen",
  UNDER_REVIEW: "In Prüfung",
  APPROVED: "Freigegeben",
  REJECTED: "Abgelehnt",
  ARCHIVED: "Archiviert",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  FLYER_PDF: "Flyer PDF",
  PRINT_FILE: "Druckdatei",
  INDESIGN: "InDesign",
  ILLUSTRATOR: "Illustrator",
  LOGO: "Logo",
  IMAGE: "Bild",
  ZIP: "ZIP",
  REPORT: "Bericht",
  INVOICE: "Rechnung",
  CONTRACT: "Vertrag",
  OTHER: "Sonstiges",
};

export const PRINT_STATUS_LABELS: Record<PrintStatus, string> = {
  REQUESTED: "Anfrage",
  APPROVED: "Freigegeben",
  IN_PRODUCTION: "In Produktion",
  SHIPPED: "Versendet",
  DELIVERED: "Geliefert",
  RECEIVED_IN_WAREHOUSE: "Im Lager angekommen",
  READY_FOR_DISTRIBUTION: "Verteilbereit",
  CANCELLED: "Storniert",
};

function printStatusNotification(status: PrintStatus, orderNumber: string) {
  if (status === "IN_PRODUCTION") {
    return {
      type: "PRINT_PRODUCTION_STARTED",
      title: "Druck gestartet",
      message: `${orderNumber}: Die Druckproduktion wurde gestartet.`,
    };
  }

  if (status === "SHIPPED") {
    return {
      type: "PRINT_SHIPPED",
      title: "Druck versendet",
      message: `${orderNumber}: Deine Flyer wurden vom Druckpartner versendet.`,
    };
  }

  if (status === "RECEIVED_IN_WAREHOUSE" || status === "READY_FOR_DISTRIBUTION") {
    return {
      type: "PRINT_RECEIVED_IN_WAREHOUSE",
      title: "Flyer im Lager angekommen",
      message: `${orderNumber}: Die gedruckten Flyer sind im FLYERO-Lager angekommen.`,
    };
  }

  return {
    type: "PRINT_STATUS_UPDATED",
    title: "Druckstatus aktualisiert",
    message: `${orderNumber}: ${PRINT_STATUS_LABELS[status]}`,
  };
}

function isAdmin(actor: SessionUser) {
  return adminRoles.includes(actor.role);
}

async function customerForActor(actor: SessionUser) {
  if (actor.role !== UserRole.CUSTOMER) return null;
  if (!actor.tenantId) throw new AuthError("Dein Konto ist keinem Unternehmen zugeordnet.", 403);
  const customer = await prisma.customerProfile.findFirst({ where: { userId: actor.id, tenantId: actor.tenantId }, select: { id: true, tenantId: true } });
  if (!customer) throw new AuthError("Kundenprofil wurde nicht gefunden.", 404);
  return customer;
}

async function assertOrderAccess(actor: SessionUser, orderId: string) {
  if (isAdmin(actor)) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, customerId: true, tenantId: true } });
    if (!order) throw new AuthError("Auftrag wurde nicht gefunden.", 404);
    return order;
  }

  const customer = await customerForActor(actor);
  if (!customer) throw new AuthError("Keine Berechtigung für Kundendokumente.", 403);
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId: customer.id, tenantId: customer.tenantId }, select: { id: true, customerId: true, tenantId: true } });
  if (!order) throw new AuthError("Auftrag wurde nicht gefunden oder gehört nicht zu deinem Kundenkonto.", 404);
  return order;
}

function documentWhere(actor: SessionUser) {
  if (isAdmin(actor)) return {};
  if (actor.role === UserRole.CUSTOMER) {
    if (!actor.tenantId) throw new AuthError("Dein Konto ist keinem Unternehmen zugeordnet.", 403);
    return { customer: { userId: actor.id }, tenantId: actor.tenantId };
  }
  throw new AuthError("Keine Berechtigung für Dokumente.", 403);
}

function dateFilter(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function documentInclude(publicOnly: boolean) {
  return {
    order: { select: { id: true, orderNumber: true, targetAreaName: true, city: true } },
    customer: { select: { id: true, companyName: true, userId: true } },
    folder: true,
    uploadedBy: { select: { id: true, email: true, role: true } },
    approvedBy: { select: { id: true, email: true, role: true } },
    versions: { orderBy: { version: "desc" as const }, include: { uploadedBy: { select: { id: true, email: true, role: true } } } },
    comments: {
      where: publicOnly ? { visibility: "PUBLIC" as const } : undefined,
      orderBy: { createdAt: "asc" as const },
      include: { user: { select: { id: true, email: true, role: true } } },
    },
  } satisfies Prisma.DocumentInclude;
}

export type DocumentListItem = Prisma.DocumentGetPayload<{ include: ReturnType<typeof documentInclude> }>;

export async function listDocuments(actor: SessionUser, filters: Record<string, string | undefined> = {}): Promise<DocumentListItem[]> {
  const uploadedFrom = dateFilter(filters.uploadedFrom);
  const uploadedTo = dateFilter(filters.uploadedTo);
  if (uploadedTo) uploadedTo.setHours(23, 59, 59, 999);
  const minSize = filters.minSize ? Number(filters.minSize) : null;
  const maxSize = filters.maxSize ? Number(filters.maxSize) : null;
  const where: Prisma.DocumentWhereInput = {
    ...documentWhere(actor),
    ...(filters.orderId ? { orderId: filters.orderId } : {}),
    ...(filters.customerId && isAdmin(actor) ? { customerId: filters.customerId } : {}),
    ...(filters.folderId ? { folderId: filters.folderId } : {}),
    ...(filters.status && DOCUMENT_STATUS_VALUES.includes(filters.status as DocumentStatus) ? { status: filters.status as DocumentStatus } : {}),
    ...(filters.documentType && DOCUMENT_TYPE_VALUES.includes(filters.documentType as DocumentType) ? { documentType: filters.documentType as DocumentType } : {}),
    ...(filters.approval === "approved" ? { approvedAt: { not: null } } : {}),
    ...(filters.approval === "open" ? { approvedAt: null, status: { in: ["UPLOADED", "UNDER_REVIEW"] } } : {}),
    ...((uploadedFrom || uploadedTo) ? { uploadedAt: { ...(uploadedFrom ? { gte: uploadedFrom } : {}), ...(uploadedTo ? { lte: uploadedTo } : {}) } } : {}),
    ...((Number.isFinite(minSize) || Number.isFinite(maxSize)) ? { fileSize: { ...(Number.isFinite(minSize) ? { gte: minSize as number } : {}), ...(Number.isFinite(maxSize) ? { lte: maxSize as number } : {}) } } : {}),
  };

  if (filters.q) {
    const search: Prisma.DocumentWhereInput[] = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { originalFilename: { contains: filters.q, mode: "insensitive" } },
      { order: { orderNumber: { contains: filters.q, mode: "insensitive" } } },
      { order: { targetAreaName: { contains: filters.q, mode: "insensitive" } } },
    ];
    if (isAdmin(actor)) {
      search.push({ customer: { companyName: { contains: filters.q, mode: "insensitive" } } });
    }
    where.OR = search;
  }

  return prisma.document.findMany({
    where,
    include: documentInclude(!isAdmin(actor)),
    orderBy: [{ uploadedAt: "desc" }, { version: "desc" }],
    take: 150,
  }) as Promise<DocumentListItem[]>;
}

export async function getDocument(actor: SessionUser, id: string) {
  const document = await prisma.document.findFirst({
    where: { id, ...documentWhere(actor) },
    include: documentInclude(!isAdmin(actor)),
  });
  if (!document) throw new AuthError("Dokument wurde nicht gefunden oder ist nicht freigegeben.", 404);
  return document;
}

function fileFromBody(data: z.infer<typeof documentCreateSchema>, file?: UploadableDocumentFile): UploadableDocumentFile {
  if (file) return file;
  if (!data.content) throw new Error("Bitte eine echte Datei hochladen. Ersatzinhalt wird nicht akzeptiert.");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data.content) || data.content.length % 4 === 1) {
    throw new Error("Dateiinhalt muss als gültiger Base64-Inhalt übertragen werden.");
  }
  const buffer = Buffer.from(data.content, "base64");
  if (buffer.length === 0) throw new Error("Die Datei ist leer.");
  return {
    originalFilename: data.originalFilename,
    mimeType: data.mimeType || null,
    buffer,
  };
}

export async function createDocument(actor: SessionUser, input: unknown, file?: UploadableDocumentFile) {
  const data = documentCreateSchema.parse(input);
  const order = await assertOrderAccess(actor, data.orderId);
  const upload = fileFromBody(data, file);
  const stored = await storeDocumentFile(upload);

  const document = await prisma.document.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      tenantId: order.tenantId,
      folderId: data.folderId || null,
      documentType: data.documentType,
      title: data.title,
      originalFilename: upload.originalFilename,
      storedFilename: stored.storageKey,
      mimeType: stored.mimeType,
      extension: stored.extension,
      fileSize: stored.fileSize,
      checksum: stored.checksum,
      status: "UNDER_REVIEW",
      uploadedById: actor.id,
      versions: {
        create: {
          version: 1,
          storageKey: stored.storageKey,
          fileUrl: "pending",
          checksum: stored.checksum,
          uploadedById: actor.id,
        },
      },
    },
    include: documentInclude(false),
  });

  await prisma.documentVersion.updateMany({
    where: { documentId: document.id, version: 1 },
    data: { fileUrl: protectedDocumentUrl(document.id, 1) },
  });
  await createAuditLog({ userId: actor.id, action: "document.uploaded", entityType: "Document", entityId: document.id, newValues: { type: document.documentType, status: document.status } });
  await notifyAdmins({ type: "DOCUMENT_UPLOADED", title: "Neue Druckdatei", message: `${document.title} wurde hochgeladen.`, data: { documentId: document.id } });
  await createNotification({ userId: actor.id, type: "DOCUMENT_UPLOADED", title: "Dokument hochgeladen", message: `${document.title} wurde gespeichert.`, data: { documentId: document.id } });
  return getDocument(actor, document.id);
}

export async function addDocumentVersion(actor: SessionUser, id: string, input: unknown, file?: UploadableDocumentFile) {
  const document = await getDocument(actor, id);
  const data = documentCreateSchema.partial({ orderId: true, documentType: true, title: true }).parse(input);
  const upload = fileFromBody({
    orderId: document.orderId,
    documentType: document.documentType,
    title: document.title,
    originalFilename: data.originalFilename || document.originalFilename,
    mimeType: data.mimeType || document.mimeType,
    content: data.content,
    folderId: document.folderId ?? undefined,
  }, file);
  const stored = await storeDocumentFile(upload);
  const nextVersion = document.version + 1;

  const updated = await prisma.document.update({
    where: { id: document.id },
    data: {
      originalFilename: upload.originalFilename,
      storedFilename: stored.storageKey,
      mimeType: stored.mimeType,
      extension: stored.extension,
      fileSize: stored.fileSize,
      checksum: stored.checksum,
      version: nextVersion,
      status: "UNDER_REVIEW",
      uploadedById: actor.id,
      uploadedAt: new Date(),
      approvedById: null,
      approvedAt: null,
      rejectedReason: null,
      versions: {
        create: {
          version: nextVersion,
          storageKey: stored.storageKey,
          fileUrl: protectedDocumentUrl(document.id, nextVersion),
          checksum: stored.checksum,
          uploadedById: actor.id,
        },
      },
    },
    include: documentInclude(false),
  });

  await createAuditLog({ userId: actor.id, action: "document.version_uploaded", entityType: "Document", entityId: document.id, newValues: { version: nextVersion } });
  await notifyAdmins({ type: "DOCUMENT_VERSION_UPLOADED", title: "Neue Dokumentversion", message: `${updated.title} Version ${nextVersion} wartet auf Prüfung.`, data: { documentId: document.id } });
  return updated;
}

export async function updateDocument(actor: SessionUser, id: string, input: unknown) {
  if (!isAdmin(actor)) throw new AuthError("Nur Admin/Support darf Dokumente bearbeiten.", 403);
  const data = documentUpdateSchema.parse(input);
  const updated = await prisma.document.update({ where: { id }, data, include: documentInclude(false) });
  await createAuditLog({ userId: actor.id, action: "document.updated", entityType: "Document", entityId: id, newValues: data });
  return updated;
}

export async function approveDocument(actor: SessionUser, id: string, message?: string) {
  if (!isAdmin(actor)) throw new AuthError("Nur Admin/Support darf Dokumente freigeben.", 403);
  const document = await prisma.document.update({
    where: { id },
    data: { status: "APPROVED", approvedById: actor.id, approvedAt: new Date(), rejectedReason: null },
    include: documentInclude(false),
  });
  if (message) await addDocumentComment(actor, id, { message, visibility: "PUBLIC" });
  await createAuditLog({ userId: actor.id, action: "document.approved", entityType: "Document", entityId: id, newValues: { status: document.status } });
  await createNotification({ userId: document.customer.userId, type: "DOCUMENT_APPROVED", title: "Dokument freigegeben", message: `${document.title} wurde freigegeben.`, data: { documentId: id } });
  return document;
}

export async function rejectDocument(actor: SessionUser, id: string, rejectedReason: string) {
  if (!isAdmin(actor)) throw new AuthError("Nur Admin/Support darf Dokumente ablehnen.", 403);
  const document = await prisma.document.update({
    where: { id },
    data: { status: "REJECTED", rejectedReason, approvedById: null, approvedAt: null },
    include: documentInclude(false),
  });
  await addDocumentComment(actor, id, { message: rejectedReason, visibility: "PUBLIC" });
  await createAuditLog({ userId: actor.id, action: "document.rejected", entityType: "Document", entityId: id, newValues: { rejectedReason } });
  await createNotification({ userId: document.customer.userId, type: "DOCUMENT_REJECTED", title: "Dokument abgelehnt", message: rejectedReason, data: { documentId: id } });
  return document;
}

export async function addDocumentComment(actor: SessionUser, id: string, input: unknown) {
  const document = await getDocument(actor, id);
  const data = documentCommentSchema.parse(input);
  const visibility = isAdmin(actor) ? data.visibility : "PUBLIC";
  return prisma.documentComment.create({ data: { documentId: document.id, userId: actor.id, visibility, message: data.message } });
}

export async function getDocumentDownload(actor: SessionUser, id: string, version?: number) {
  const document = await getDocument(actor, id);
  const selected = version ? document.versions.find((item) => item.version === version) : null;
  if (version && !selected) throw new AuthError("Diese Dokumentversion wurde nicht gefunden.", 404);
  const storageKey = selected?.storageKey ?? document.storedFilename;
  if (selected && !storageKey) throw new AuthError("Diese Dokumentversion ist nicht mehr verfügbar.", 404);
  const stored = await readStoredDocument(storageKey);
  await createAuditLog({ userId: actor.id, action: "document.downloaded", entityType: "Document", entityId: document.id, metadata: { version: version ?? document.version } });
  return { ...stored, filename: document.originalFilename, mimeType: document.mimeType };
}

function printScope(actor: SessionUser) {
  if (isAdmin(actor)) return {};
  if (actor.role === UserRole.CUSTOMER) {
    if (!actor.tenantId) throw new AuthError("Dein Konto ist keinem Unternehmen zugeordnet.", 403);
    return { customer: { userId: actor.id }, tenantId: actor.tenantId };
  }
  throw new AuthError("Keine Berechtigung für Druckaufträge.", 403);
}

type PrintOrderListItem = Prisma.PrintOrderGetPayload<{
  include: {
    order: { select: { orderNumber: true; targetAreaName: true } };
    customer: { select: { companyName: true } };
    printer: true;
    warehouseInventory: true;
  };
}>;

export async function listPrintOrders(actor: SessionUser): Promise<PrintOrderListItem[]> {
  return prisma.printOrder.findMany({
    where: printScope(actor),
    include: { order: { select: { orderNumber: true, targetAreaName: true } }, customer: { select: { companyName: true } }, printer: true, warehouseInventory: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  }) as Promise<PrintOrderListItem[]>;
}

export async function createPrintOrder(actor: SessionUser, input: unknown) {
  const data = printOrderCreateSchema.parse(input);
  const order = await assertOrderAccess(actor, data.orderId);
  const assigned = await assignWarehouseForOrder({ orderId: order.id, userId: actor.id, reserveCapacity: true });
  const printOrder = await prisma.printOrder.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      tenantId: order.tenantId,
      printerId: data.printerId || null,
      assignedWarehouseId: assigned.warehouse?.id ?? null,
      printFormat: data.printFormat,
      paperType: data.paperType,
      paperWeight: data.paperWeight,
      colorMode: data.colorMode,
      doubleSided: data.doubleSided,
      folded: data.folded,
      finishing: data.finishing,
      quantity: data.quantity,
      notes: data.notes,
      priceSnapshot: { mode: "manual_later", note: "Druckherstellungspreise werden mit echten FLYERO-Konditionen nachgepflegt." },
    },
    include: { order: true, customer: true, printer: true },
  });
  if (assigned.warehouse) {
    await createLogisticsShipment({
      orderId: order.id,
      printOrderId: printOrder.id,
      warehouseId: assigned.warehouse.id,
      shipmentType: "PRINTER_TO_WAREHOUSE",
      actorId: actor.id,
      senderName: printOrder.printer?.companyName ?? "Druckpartner",
      senderAddress: printOrder.printer?.address as Prisma.InputJsonValue | undefined,
      recipientName: assigned.warehouse.name,
      recipientAddress: warehouseAddressJson(assigned.warehouse),
      expectedDeliveryDate: printOrder.estimatedDelivery,
      notes: `Druckauftrag für ${printOrder.order.orderNumber}.`,
    });
  }
  await prisma.order.update({ where: { id: order.id }, data: { needsPrintService: true, customerOwnFlyers: false } });
  await createAuditLog({ userId: actor.id, action: "print.requested", entityType: "PrintOrder", entityId: printOrder.id, newValues: { status: printOrder.status, quantity: printOrder.quantity } });
  await notifyAdmins({ type: "PRINT_ORDER_REQUESTED", title: "Druckauftrag", message: `${printOrder.order.orderNumber}: Druckauftrag wurde angefragt.`, data: { printOrderId: printOrder.id } });
  await createNotification({ userId: actor.id, type: "PRINT_ORDER_REQUESTED", title: "Druckauftrag angefragt", message: "Dein Druckauftrag wurde gespeichert.", data: { printOrderId: printOrder.id } });
  return printOrder;
}

async function ensureWarehouseInventoryForPrint(printOrderId: string, actor: SessionUser) {
  const printOrder = await prisma.printOrder.findUnique({ where: { id: printOrderId }, include: { order: true } });
  if (!printOrder) throw new AuthError("Druckauftrag wurde nicht gefunden.", 404);
  const assigned = await assignWarehouseForOrder({ orderId: printOrder.orderId, userId: actor.id, reserveCapacity: false });
  const warehouseId = printOrder.assignedWarehouseId ?? assigned.warehouse?.id ?? null;
  const existing = await prisma.warehouseInventory.findUnique({ where: { orderId: printOrder.orderId } });
  if (existing) {
    return prisma.warehouseInventory.update({
      where: { id: existing.id },
      data: {
        warehouseId,
        status: "FLYERS_RECEIVED",
        expectedFlyers: printOrder.quantity,
        receivedFlyers: printOrder.quantity,
        receivedAt: new Date(),
      },
    });
  }
  const inventory = await prisma.warehouseInventory.create({
    data: {
      orderId: printOrder.orderId,
      warehouseId,
      status: "FLYERS_RECEIVED",
      qrCode: `FLY-WH-${printOrder.order.orderNumber}-${Date.now()}`,
      pickupToken: `PICK-${printOrder.order.orderNumber}-${Date.now()}`,
      expectedFlyers: printOrder.quantity,
      receivedFlyers: printOrder.quantity,
      receivedAt: new Date(),
      notes: "Automatisch durch Druckstatus RECEIVED_IN_WAREHOUSE angelegt.",
    },
  });
  await createAuditLog({ userId: actor.id, action: "print.received", entityType: "WarehouseInventory", entityId: inventory.id, newValues: { printOrderId } });
  return inventory;
}

export async function updatePrintOrder(actor: SessionUser, id: string, input: unknown) {
  if (!isAdmin(actor)) throw new AuthError("Nur Admin/Support darf Druckaufträge bearbeiten.", 403);
  const data = printOrderUpdateSchema.parse(input);
  const current = await prisma.printOrder.findUnique({ where: { id }, include: { customer: true, order: true } });
  if (!current) throw new AuthError("Druckauftrag wurde nicht gefunden.", 404);

  let warehouseInventoryId = current.warehouseInventoryId;
  if (data.status === "RECEIVED_IN_WAREHOUSE" || data.status === "READY_FOR_DISTRIBUTION") {
    const inventory = await ensureWarehouseInventoryForPrint(id, actor);
    warehouseInventoryId = inventory.id;
    await prisma.order.update({ where: { id: current.orderId }, data: { status: "READY_FOR_DISTRIBUTION" } });
    await createOrderStatusEvent({ orderId: current.orderId, fromStatus: current.order.status, toStatus: "READY_FOR_DISTRIBUTION", changedBy: actor.id, note: "Druckware im Lager angekommen." });
  }

  const updated = await prisma.printOrder.update({
    where: { id },
    data: {
      printerId: data.printerId,
      status: data.status,
      estimatedDelivery: data.estimatedDelivery,
      trackingNumber: data.trackingNumber,
      notes: data.notes,
      estimatedNetPrice: data.estimatedNetPrice,
      estimatedGrossPrice: data.estimatedGrossPrice,
      warehouseInventoryId,
      priceSnapshot: data.estimatedNetPrice || data.estimatedGrossPrice ? { mode: "manual_flyero_price", updatedBy: actor.id } : undefined,
    },
    include: { order: true, customer: true, printer: true, warehouseInventory: true },
  });

  const action = data.status === "IN_PRODUCTION"
    ? "print.production_started"
    : data.status === "SHIPPED"
      ? "print.shipped"
      : data.status === "RECEIVED_IN_WAREHOUSE" || data.status === "READY_FOR_DISTRIBUTION"
        ? "print.received"
        : "print.updated";
  await createAuditLog({ userId: actor.id, action, entityType: "PrintOrder", entityId: id, oldValues: { status: current.status }, newValues: { status: updated.status } });
  const notification = printStatusNotification(updated.status, current.order.orderNumber);
  await createNotification({ userId: current.customer.userId, ...notification, data: { printOrderId: id } });
  const shipment = await prisma.logisticsShipment.findFirst({ where: { printOrderId: id, shipmentType: "PRINTER_TO_WAREHOUSE" } });
  if (shipment && data.status) {
    const shipmentStatus =
      data.status === "SHIPPED"
        ? "IN_TRANSIT"
        : data.status === "DELIVERED"
          ? "DELIVERED"
          : data.status === "RECEIVED_IN_WAREHOUSE" || data.status === "READY_FOR_DISTRIBUTION"
            ? "RECEIVED"
            : null;
    if (shipmentStatus) {
      await updateLogisticsShipment({ id: shipment.id, actor, status: shipmentStatus, trackingNumber: updated.trackingNumber ?? undefined, expectedDeliveryDate: updated.estimatedDelivery ?? undefined });
    }
  }
  return updated;
}

export async function listPrintPartners() {
  return prisma.printPartner.findMany({ orderBy: [{ isActive: "desc" }, { companyName: "asc" }] });
}

export async function createPrintPartner(actor: SessionUser, input: unknown) {
  if (!isAdmin(actor)) throw new AuthError("Nur Admin/Support darf Druckpartner anlegen.", 403);
  const data = printPartnerSchema.parse(input);
  const partner = await prisma.printPartner.create({
    data: {
      companyName: data.companyName,
      contactName: data.contactName || null,
      email: data.email,
      phone: data.phone || null,
      address: normalizeAddressJson(data.address),
      isActive: data.isActive,
    },
  });
  await createAuditLog({ userId: actor.id, action: "print_partner.created", entityType: "PrintPartner", entityId: partner.id, newValues: partner });
  return partner;
}

export async function updatePrintPartner(actor: SessionUser, id: string, input: unknown) {
  if (!isAdmin(actor)) throw new AuthError("Nur Admin/Support darf Druckpartner bearbeiten.", 403);
  const data = printPartnerSchema.partial().parse(input);
  const partner = await prisma.printPartner.update({
    where: { id },
    data: {
      companyName: data.companyName,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone,
      address: data.address === undefined ? undefined : normalizeAddressJson(data.address),
      isActive: data.isActive,
    },
  });
  await createAuditLog({ userId: actor.id, action: "print_partner.updated", entityType: "PrintPartner", entityId: id, newValues: partner });
  return partner;
}

export async function getDocumentAnalytics() {
  const [documents, versions, printOrders, byType, byStatus, printStatus, approvedDocs, completedPrintOrders] = await Promise.all([
    prisma.document.count(),
    prisma.documentVersion.count(),
    prisma.printOrder.count(),
    prisma.document.groupBy({ by: ["documentType"], _count: { _all: true } }),
    prisma.document.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.printOrder.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.document.findMany({ where: { approvedAt: { not: null } }, select: { uploadedAt: true, approvedAt: true }, take: 300 }),
    prisma.printOrder.findMany({
      where: { status: { in: ["SHIPPED", "DELIVERED", "RECEIVED_IN_WAREHOUSE", "READY_FOR_DISTRIBUTION"] } },
      select: { createdAt: true, updatedAt: true },
      take: 300,
    }),
  ]);
  const approvalHours = approvedDocs.length
    ? approvedDocs.reduce((sum, item) => sum + ((item.approvedAt?.getTime() ?? item.uploadedAt.getTime()) - item.uploadedAt.getTime()) / 36e5, 0) / approvedDocs.length
    : 0;
  const printProcessDays = completedPrintOrders.length
    ? completedPrintOrders.reduce((sum, item) => sum + (item.updatedAt.getTime() - item.createdAt.getTime()) / 86_400_000, 0) / completedPrintOrders.length
    : 0;
  return {
    documents,
    versions,
    printOrders,
    averageApprovalHours: Number(approvalHours.toFixed(1)),
    averagePrintProcessDays: Number(printProcessDays.toFixed(1)),
    byType: byType.map((item) => ({ type: item.documentType, count: item._count._all })),
    byStatus: byStatus.map((item) => ({ status: item.status, count: item._count._all })),
    printStatus: printStatus.map((item) => ({ status: item.status, count: item._count._all })),
  };
}
