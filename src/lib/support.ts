import {
  Prisma,
  SupportTicketStatus,
  TicketMessageVisibility,
  TicketPriority,
  TicketType,
  UserRole,
} from "@prisma/client";
import { z } from "zod";
import { AuthError, type SessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER];

export const ticketCreateSchema = z.object({
  type: z.enum(TicketType).default(TicketType.CUSTOMER_SUPPORT),
  priority: z.enum(TicketPriority).default(TicketPriority.NORMAL),
  subject: z.string().trim().min(3).max(180),
  description: z.string().trim().min(5).max(6000),
  customerId: z.string().optional(),
  distributorId: z.string().optional(),
  orderId: z.string().optional(),
  tourId: z.string().optional(),
  reportId: z.string().optional(),
  warehouseInventoryId: z.string().optional(),
});

export const ticketUpdateSchema = z.object({
  status: z.enum(SupportTicketStatus).optional(),
  priority: z.enum(TicketPriority).optional(),
  assignedToId: z.string().nullable().optional(),
  resolution: z.string().trim().max(6000).nullable().optional(),
});

export const ticketMessageSchema = z.object({
  message: z.string().trim().min(2).max(6000),
  visibility: z.enum(TicketMessageVisibility).default(TicketMessageVisibility.PUBLIC),
});

export const ticketListFilterSchema = z.object({
  status: z.enum(SupportTicketStatus).optional(),
  type: z.enum(TicketType).optional(),
  priority: z.enum(TicketPriority).optional(),
  q: z.string().trim().optional(),
});

export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Bearbeitung",
  WAITING_FOR_CUSTOMER: "Wartet auf Kunden",
  WAITING_INTERNAL: "Wartet intern",
  RESOLVED: "Gelöst",
  REJECTED: "Abgelehnt",
  CLOSED: "Geschlossen",
};

export const SUPPORT_TYPE_LABELS: Record<TicketType, string> = {
  CUSTOMER_SUPPORT: "Kundenservice",
  COMPLAINT: "Reklamation",
  TOUR_ISSUE: "Tourproblem",
  WAREHOUSE_ISSUE: "Lagerproblem",
  BILLING_ISSUE: "Abrechnung",
  TECHNICAL_ISSUE: "Technik",
  OTHER: "Sonstiges",
};

export const SUPPORT_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Niedrig",
  NORMAL: "Normal",
  HIGH: "Hoch",
  URGENT: "Dringend",
};

export function isSupportAdmin(actor: SessionUser) {
  return adminRoles.includes(actor.role);
}

function ticketInclude(publicOnly: boolean) {
  return {
    customer: { include: { user: { select: { email: true } } } },
    distributor: { include: { user: { select: { email: true } } } },
    order: { select: { id: true, orderNumber: true, targetAreaName: true, city: true, postalCode: true } },
    tour: { select: { id: true, status: true, startedAt: true, endTime: true, adminReviewStatus: true, fraudFlags: true } },
    report: { select: { id: true, reportNumber: true, status: true, pdfUrl: true, onlineUrl: true } },
    warehouseInventory: { select: { id: true, status: true, qrCode: true, expectedFlyers: true, receivedFlyers: true } },
    assignedTo: { select: { id: true, email: true, role: true } },
    createdBy: { select: { id: true, email: true, role: true } },
    messages: {
      where: publicOnly ? { visibility: TicketMessageVisibility.PUBLIC } : undefined,
      include: {
        sender: { select: { id: true, email: true, role: true } },
        attachments: true,
      },
      orderBy: { createdAt: "asc" as const },
    },
    attachments: true,
  };
}

async function nextTicketNumber(tx: Prisma.TransactionClient) {
  const currentYear = new Date().getFullYear();
  let settings = await tx.numberingSettings.findFirst({ orderBy: { createdAt: "asc" } });

  if (!settings) {
    settings = await tx.numberingSettings.create({
      data: {
        invoiceYear: currentYear,
        reportYear: currentYear,
        orderYear: currentYear,
        ticketYear: currentYear,
        ticketNextNumber: 1,
      },
    });
  }

  const nextNumber = settings.ticketYear === currentYear ? settings.ticketNextNumber : 1;
  const ticketNumber = `${settings.ticketPrefix}-${currentYear}-${String(nextNumber).padStart(6, "0")}`;

  await tx.numberingSettings.update({
    where: { id: settings.id },
    data: {
      ticketYear: currentYear,
      ticketNextNumber: nextNumber + 1,
    },
  });

  return ticketNumber;
}

async function resolveCustomerId(actor: SessionUser, requestedCustomerId?: string | null) {
  if (actor.role === UserRole.CUSTOMER) {
    if (!actor.tenantId) throw new AuthError("Dein Konto ist keinem Unternehmen zugeordnet.", 403);
    const profile = await prisma.customerProfile.findFirst({ where: { userId: actor.id, tenantId: actor.tenantId }, select: { id: true } });
    if (!profile) throw new AuthError("Kundenprofil wurde nicht gefunden.", 404);
    return profile.id;
  }

  return requestedCustomerId ?? null;
}

async function resolveDistributorId(actor: SessionUser, requestedDistributorId?: string | null) {
  if (actor.role === UserRole.DISTRIBUTOR) {
    const profile = await prisma.distributorProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
    if (!profile) throw new AuthError("Verteilerprofil wurde nicht gefunden.", 404);
    return profile.id;
  }

  return requestedDistributorId ?? null;
}

async function assertCustomerLinks(customerId: string | null, tenantId: string | null, data: z.infer<typeof ticketCreateSchema>) {
  if (!customerId) return;

  if (data.orderId) {
    const order = await prisma.order.findFirst({ where: { id: data.orderId, customerId, tenantId: tenantId ?? undefined }, select: { id: true } });
    if (!order) throw new AuthError("Dieser Auftrag gehört nicht zu deinem Kundenkonto.", 403);
  }

  if (data.reportId) {
    const report = await prisma.report.findFirst({
      where: { id: data.reportId, customerId, tenantId: tenantId ?? undefined },
      select: { id: true, orderId: true, tourId: true },
    });
    if (!report) throw new AuthError("Dieser Bericht gehört nicht zu deinem Kundenkonto.", 403);
  }
}

async function assertDistributorLinks(distributorId: string | null, data: z.infer<typeof ticketCreateSchema>) {
  if (!distributorId) return;

  if (data.tourId) {
    const tour = await prisma.distributionTour.findFirst({ where: { id: data.tourId, distributorId }, select: { id: true } });
    if (!tour) throw new AuthError("Diese Tour gehört nicht zu deinem Verteilerkonto.", 403);
  }
}

function scopeWhere(actor: SessionUser): Prisma.SupportTicketWhereInput {
  if (isSupportAdmin(actor)) return {};
  if (actor.role === UserRole.CUSTOMER) {
    if (!actor.tenantId) throw new AuthError("Dein Konto ist keinem Unternehmen zugeordnet.", 403);
    return { tenantId: actor.tenantId, customer: { userId: actor.id, tenantId: actor.tenantId } };
  }
  if (actor.role === UserRole.DISTRIBUTOR) return { distributor: { userId: actor.id } };
  throw new AuthError("Keine Berechtigung für Support-Tickets.", 403);
}

export function parseTicketFilters(input: Record<string, string | undefined>) {
  return ticketListFilterSchema.parse(input);
}

export async function listTickets(actor: SessionUser, filters: z.infer<typeof ticketListFilterSchema> = {}) {
  const where: Prisma.SupportTicketWhereInput = {
    ...scopeWhere(actor),
    status: filters.status,
    type: filters.type,
    priority: filters.priority,
    ...(filters.q
      ? {
          OR: [
            { ticketNumber: { contains: filters.q, mode: "insensitive" } },
            { subject: { contains: filters.q, mode: "insensitive" } },
            { description: { contains: filters.q, mode: "insensitive" } },
            { order: { orderNumber: { contains: filters.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  return prisma.supportTicket.findMany({
    where,
    include: ticketInclude(!isSupportAdmin(actor)),
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });
}

export async function getTicket(actor: SessionUser, id: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, ...scopeWhere(actor) },
    include: ticketInclude(!isSupportAdmin(actor)),
  });

  if (!ticket) throw new AuthError("Ticket wurde nicht gefunden oder ist nicht freigegeben.", 404);
  return ticket;
}

export async function createTicket(actor: SessionUser, input: unknown) {
  const data = ticketCreateSchema.parse(input);
  const customerId = await resolveCustomerId(actor, data.customerId);
  const distributorId = await resolveDistributorId(actor, data.distributorId);

  if (actor.role === UserRole.CUSTOMER) await assertCustomerLinks(customerId, actor.tenantId ?? null, data);
  if (actor.role === UserRole.DISTRIBUTOR) await assertDistributorLinks(distributorId, data);
  if (!customerId && !distributorId && !isSupportAdmin(actor)) {
    throw new AuthError("Für dieses Ticket fehlt ein erlaubter Bezug.", 403);
  }

  const customerTenant = customerId
    ? await prisma.customerProfile.findUnique({ where: { id: customerId }, select: { tenantId: true } })
    : null;
  const linkedOrder = data.orderId
    ? await prisma.order.findUnique({ where: { id: data.orderId }, select: { tenantId: true } })
    : null;
  const tenantId = actor.role === UserRole.CUSTOMER ? actor.tenantId : customerTenant?.tenantId ?? linkedOrder?.tenantId ?? null;

  const ticket = await prisma.$transaction(async (tx) => {
    const ticketNumber = await nextTicketNumber(tx);
    const created = await tx.supportTicket.create({
      data: {
        ticketNumber,
        type: data.type,
        priority: data.priority,
        customerId,
        tenantId,
        distributorId,
        orderId: data.orderId ?? null,
        tourId: data.tourId ?? null,
        reportId: data.reportId ?? null,
        warehouseInventoryId: data.warehouseInventoryId ?? null,
        subject: data.subject,
        description: data.description,
        message: data.description,
        createdById: actor.id,
        messages: {
          create: {
            senderId: actor.id,
            senderRole: actor.role,
            visibility: TicketMessageVisibility.PUBLIC,
            message: data.description,
          },
        },
      },
      include: ticketInclude(false),
    });
    return created;
  });

  await createAuditLog({
    userId: actor.id,
    action: data.type === TicketType.COMPLAINT ? "ticket.complaint_created" : "ticket.created",
    entityType: "SupportTicket",
    entityId: ticket.id,
    newValues: { ticketNumber: ticket.ticketNumber, type: ticket.type, priority: ticket.priority },
  });

  await notifyAdmins({
    type: data.type === TicketType.COMPLAINT || data.priority === TicketPriority.URGENT ? "URGENT_SUPPORT_TICKET" : "SUPPORT_TICKET_CREATED",
    title: `${ticket.ticketNumber}: ${data.subject}`,
    message: `${SUPPORT_TYPE_LABELS[data.type]} wurde erstellt.`,
    data: { ticketNumber: ticket.ticketNumber, ticketId: ticket.id },
  });

  await notifyTicketOwner(ticket.id, "SUPPORT_TICKET_CREATED", "Ticket erstellt", `Dein Ticket ${ticket.ticketNumber} wurde angelegt.`);
  return ticket;
}

async function notifyTicketOwner(ticketId: string, type: string, title: string, message: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      customer: { select: { userId: true } },
      distributor: { select: { userId: true } },
    },
  });

  const userIds = [ticket?.customer?.userId, ticket?.distributor?.userId].filter(Boolean) as string[];
  await Promise.all(userIds.map((userId) => createNotification({ userId, type, title, message, data: { ticketId, ticketNumber: ticket?.ticketNumber } })));
}

export async function updateTicket(actor: SessionUser, id: string, input: unknown) {
  if (!isSupportAdmin(actor)) throw new AuthError("Nur Admin/Support darf Tickets bearbeiten.", 403);
  const data = ticketUpdateSchema.parse(input);
  const current = await prisma.supportTicket.findUnique({ where: { id } });
  if (!current) throw new AuthError("Ticket wurde nicht gefunden.", 404);

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      status: data.status,
      priority: data.priority,
      assignedToId: data.assignedToId,
      resolution: data.resolution,
      closedAt: data.status === SupportTicketStatus.CLOSED && !current.closedAt ? new Date() : undefined,
    },
    include: ticketInclude(false),
  });

  const changes: Array<[boolean, string, unknown, unknown]> = [
    [Boolean(data.status && data.status !== current.status), "ticket.status_changed", current.status, data.status],
    [Boolean(data.priority && data.priority !== current.priority), "ticket.priority_changed", current.priority, data.priority],
    [data.assignedToId !== undefined && data.assignedToId !== current.assignedToId, "ticket.assigned", current.assignedToId, data.assignedToId],
  ];

  await Promise.all(
    changes
      .filter(([changed]) => changed)
      .map(([, action, oldValue, newValue]) =>
        createAuditLog({
          userId: actor.id,
          action,
          entityType: "SupportTicket",
          entityId: id,
          oldValues: oldValue,
          newValues: newValue,
        }),
      ),
  );

  if (data.status === SupportTicketStatus.CLOSED) {
    await notifyTicketOwner(id, "SUPPORT_TICKET_CLOSED", "Ticket geschlossen", `Ticket ${updated.ticketNumber} wurde geschlossen.`);
  }

  return updated;
}

export async function addTicketMessage(actor: SessionUser, id: string, input: unknown) {
  const data = ticketMessageSchema.parse(input);
  const ticket = await getTicket(actor, id);
  const visibility = isSupportAdmin(actor) ? data.visibility : TicketMessageVisibility.PUBLIC;

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: actor.id,
      senderRole: actor.role,
      visibility,
      message: data.message,
    },
    include: { sender: { select: { id: true, email: true, role: true } }, attachments: true },
  });

  await createAuditLog({
    userId: actor.id,
    action: "ticket.message_added",
    entityType: "SupportTicket",
    entityId: ticket.id,
    newValues: { messageId: message.id, visibility },
  });

  if (isSupportAdmin(actor) && visibility === TicketMessageVisibility.PUBLIC) {
    await notifyTicketOwner(ticket.id, "SUPPORT_TICKET_ANSWERED", "Antwort erhalten", `Neue Antwort zu Ticket ${ticket.ticketNumber}.`);
  } else if (!isSupportAdmin(actor)) {
    await notifyAdmins({
      type: "SUPPORT_TICKET_CUSTOMER_REPLY",
      title: `Neue Antwort: ${ticket.ticketNumber}`,
      message: data.message.slice(0, 240),
      data: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
    });
  }

  return message;
}

export async function closeTicket(actor: SessionUser, id: string, resolution?: string) {
  return updateTicket(actor, id, { status: SupportTicketStatus.CLOSED, resolution: resolution ?? null });
}

export async function getSupportAnalytics() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [openTickets, urgentTickets, complaintsThisMonth, byType, byStatus, resolvedTickets] = await Promise.all([
    prisma.supportTicket.count({ where: { status: { notIn: [SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED] } } }),
    prisma.supportTicket.count({ where: { priority: TicketPriority.URGENT, status: { notIn: [SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED] } } }),
    prisma.supportTicket.count({ where: { type: TicketType.COMPLAINT, createdAt: { gte: startOfMonth } } }),
    prisma.supportTicket.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.supportTicket.findMany({
      where: { closedAt: { not: null } },
      select: { createdAt: true, closedAt: true },
      take: 200,
      orderBy: { closedAt: "desc" },
    }),
  ]);

  const avgResolutionHours = resolvedTickets.length
    ? resolvedTickets.reduce((sum, ticket) => sum + ((ticket.closedAt?.getTime() ?? ticket.createdAt.getTime()) - ticket.createdAt.getTime()) / 36e5, 0) / resolvedTickets.length
    : 0;

  return {
    openTickets,
    urgentTickets,
    complaintsThisMonth,
    avgResolutionHours: Number(avgResolutionHours.toFixed(1)),
    byType: byType.map((item) => ({ type: item.type, count: item._count._all })),
    byStatus: byStatus.map((item) => ({ status: item.status, count: item._count._all })),
  };
}
