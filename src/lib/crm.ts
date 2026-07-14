import { LeadPriority, LeadStatus, LeadType, Prisma, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { productionLeadWhere, productionUserWhere } from "@/lib/productionData";
import { createCustomerTenant } from "@/lib/tenant";
import { leadScopeWhere, type LeadScope } from "@/lib/leadScope";

const leadStatusValues = Object.values(LeadStatus) as [LeadStatus, ...LeadStatus[]];
const leadPriorityValues = Object.values(LeadPriority) as [LeadPriority, ...LeadPriority[]];

const optionalText = (max = 3000) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const optionalDate = z.preprocess((value) => {
  if (!value || (typeof value === "string" && value.trim() === "")) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}, z.date().optional());

const optionalNumber = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}, z.number().optional());

export const crmLeadUpdateSchema = z.object({
  status: z.enum(leadStatusValues).optional(),
  priority: z.enum(leadPriorityValues).optional(),
  assignedToId: optionalText(120).nullable().optional(),
  nextFollowUpAt: optionalDate.nullable().optional(),
  lastContactedAt: optionalDate.nullable().optional(),
  sourceCampaign: optionalText(160).nullable().optional(),
  estimatedOrderVolume: optionalNumber.nullable().optional(),
  expectedFlyerQuantity: optionalNumber.nullable().optional(),
  notes: optionalText(5000).nullable().optional(),
  lostReason: optionalText(1200).nullable().optional(),
  adminNote: optionalText(3000).nullable().optional(),
  archive: z.preprocess((value) => value === true || value === "true" || value === "on" || value === "1", z.boolean()).optional(),
});

export const crmStatusSchema = z.object({
  status: z.enum(leadStatusValues),
  detail: optionalText(1200),
  lostReason: optionalText(1200),
});

export const crmAssignSchema = z.object({
  assignedToId: optionalText(120).nullable().optional(),
});

export const crmNoteSchema = z.object({
  body: z.string().trim().min(2).max(5000),
});

export type LeadListFilters = {
  search?: string;
  status?: LeadStatus;
  priority?: LeadPriority;
  city?: string;
  type?: LeadType;
  archived?: "false" | "true" | "all";
};

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function parseStatus(value?: string | null) {
  return value && Object.values(LeadStatus).includes(value as LeadStatus) ? value as LeadStatus : undefined;
}

function parsePriority(value?: string | null) {
  return value && Object.values(LeadPriority).includes(value as LeadPriority) ? value as LeadPriority : undefined;
}

function parseType(value?: string | null) {
  return value && Object.values(LeadType).includes(value as LeadType) ? value as LeadType : undefined;
}

export function parseLeadListFilters(input: Record<string, string | string[] | undefined>): LeadListFilters {
  const value = (key: string) => {
    const raw = input[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  const archived = value("archived");
  return {
    search: clean(value("search")),
    status: parseStatus(value("status")),
    priority: parsePriority(value("priority")),
    city: clean(value("city")),
    type: parseType(value("type")),
    archived: archived === "true" || archived === "all" ? archived : "false",
  };
}

function leadWhere(filters: LeadListFilters) {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.city ? { city: { contains: filters.city, mode: Prisma.QueryMode.insensitive } } : {}),
    ...(filters.archived === "true" ? { archivedAt: { not: null } } : filters.archived === "all" ? {} : { archivedAt: null }),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
            { companyName: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
            { city: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
  };
}

function serializeLeadValues(lead: unknown) {
  return JSON.parse(JSON.stringify(lead, (_key, value) => {
    if (value && typeof value === "object" && "toString" in value && value.constructor?.name === "Decimal") {
      return value.toString();
    }
    return value;
  }));
}

export async function listCrmLeads(filters: LeadListFilters, scope: LeadScope) {
  return prisma.lead.findMany({
    where: { AND: [leadScopeWhere(scope), productionLeadWhere(), leadWhere(filters)] },
    include: {
      assignedTo: { select: { id: true, email: true, role: true } },
      wonCustomer: { select: { id: true, companyName: true } },
      leadNotes: { take: 1, orderBy: { createdAt: "desc" }, include: { author: { select: { email: true } } } },
      activities: { take: 1, orderBy: { createdAt: "desc" } },
    },
    orderBy: [{ priority: "desc" }, { nextFollowUpAt: "asc" }, { createdAt: "desc" }],
    take: 250,
  });
}

export async function getCrmLead(id: string, scope: LeadScope) {
  return prisma.lead.findFirst({
    where: { AND: [{ id }, leadScopeWhere(scope), productionLeadWhere()] },
    include: {
      assignedTo: { select: { id: true, email: true, role: true } },
      wonCustomer: { select: { id: true, companyName: true, user: { select: { email: true } } } },
      leadNotes: { include: { author: { select: { email: true } } }, orderBy: { createdAt: "desc" } },
      activities: { include: { actor: { select: { email: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getAssignableUsers(scope: LeadScope) {
  return prisma.user.findMany({
    where: {
      ...productionUserWhere(),
      role: { in: [UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER] },
      ...(scope.isGlobalAdmin ? {} : { tenantId: scope.tenantId ?? "__no_tenant__" }),
    },
    select: { id: true, email: true, role: true },
    orderBy: { email: "asc" },
  });
}

async function recordLeadActivity(input: {
  leadId: string;
  actorId?: string | null;
  event: string;
  fromStatus?: LeadStatus | null;
  toStatus?: LeadStatus | null;
  detail?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.leadActivity.create({
    data: {
      leadId: input.leadId,
      actorId: input.actorId ?? null,
      event: input.event,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      detail: input.detail ?? null,
      metadata: input.metadata,
    },
  });
}

export async function updateCrmLead(id: string, input: z.input<typeof crmLeadUpdateSchema>, actorId: string | undefined, scope: LeadScope) {
  const data = crmLeadUpdateSchema.parse(input);
  const existing = await prisma.lead.findFirst({ where: { AND: [{ id }, leadScopeWhere(scope), productionLeadWhere()] } });
  if (!existing) throw new Error("Lead wurde nicht gefunden.");

  const nextFollowUpAt = Object.prototype.hasOwnProperty.call(data, "nextFollowUpAt")
    ? data.nextFollowUpAt ?? null
    : undefined;
  const estimatedOrderVolume = Object.prototype.hasOwnProperty.call(data, "estimatedOrderVolume")
    ? data.estimatedOrderVolume === null || data.estimatedOrderVolume === undefined
      ? null
      : new Prisma.Decimal(data.estimatedOrderVolume)
    : undefined;

  const updateData: Prisma.LeadUpdateInput = {
    ...(data.status ? { status: data.status } : {}),
    ...(data.priority ? { priority: data.priority } : {}),
    ...(Object.prototype.hasOwnProperty.call(data, "assignedToId") ? { assignedTo: data.assignedToId ? { connect: { id: data.assignedToId } } : { disconnect: true } } : {}),
    ...(Object.prototype.hasOwnProperty.call(data, "nextFollowUpAt") ? { nextFollowUpAt } : {}),
    ...(Object.prototype.hasOwnProperty.call(data, "lastContactedAt") ? { lastContactedAt: data.lastContactedAt ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(data, "sourceCampaign") ? { sourceCampaign: data.sourceCampaign ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(data, "estimatedOrderVolume") ? { estimatedOrderVolume } : {}),
    ...(Object.prototype.hasOwnProperty.call(data, "expectedFlyerQuantity") ? { expectedFlyerQuantity: data.expectedFlyerQuantity ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(data, "notes") ? { notes: data.notes ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(data, "lostReason") ? { lostReason: data.lostReason ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(data, "adminNote") ? { adminNote: data.adminNote ?? null } : {}),
    ...(data.archive !== undefined ? { archivedAt: data.archive ? new Date() : null, ...(data.archive ? { status: LeadStatus.ARCHIVED } : {}) } : {}),
  };

  const lead = await prisma.lead.update({ where: { id }, data: updateData });
  const event = nextFollowUpAt !== undefined ? "lead.followup_set" : data.assignedToId !== undefined ? "lead.assigned" : "lead.updated";

  await recordLeadActivity({
    leadId: lead.id,
    actorId,
    event,
    fromStatus: existing.status,
    toStatus: lead.status,
    metadata: serializeLeadValues({ before: existing, after: lead }) as Prisma.InputJsonValue,
  });

  await createAuditLog({
    userId: actorId,
    action: event,
    entityType: "Lead",
    entityId: lead.id,
    oldValues: serializeLeadValues(existing),
    newValues: serializeLeadValues(lead),
  });

  if (nextFollowUpAt && nextFollowUpAt <= new Date()) {
    await notifyAdmins({
      type: "LEAD_FOLLOWUP_DUE",
      title: "Follow-up fällig",
      message: `${lead.name} ist für ein Follow-up fällig.`,
      data: { leadId: lead.id, leadEmail: lead.email },
    });
  }

  return lead;
}

export async function changeLeadStatus(id: string, input: z.input<typeof crmStatusSchema>, actorId: string | undefined, scope: LeadScope) {
  const data = crmStatusSchema.parse(input);
  const existing = await prisma.lead.findFirst({ where: { AND: [{ id }, leadScopeWhere(scope), productionLeadWhere()] } });
  if (!existing) throw new Error("Lead wurde nicht gefunden.");

  const now = new Date();
  const lead = await prisma.lead.update({
    where: { id },
    data: {
      status: data.status,
      ...(data.status === LeadStatus.CONTACTED ? { lastContactedAt: now } : {}),
      ...(data.status === LeadStatus.LOST ? { lostReason: data.lostReason ?? data.detail ?? existing.lostReason } : {}),
      ...(data.status === LeadStatus.ARCHIVED ? { archivedAt: now } : {}),
      ...(data.status !== LeadStatus.ARCHIVED && existing.status === LeadStatus.ARCHIVED ? { archivedAt: null } : {}),
    },
  });

  const event = data.status === LeadStatus.WON ? "lead.won" : data.status === LeadStatus.LOST ? "lead.lost" : "lead.status_changed";
  await recordLeadActivity({
    leadId: lead.id,
    actorId,
    event,
    fromStatus: existing.status,
    toStatus: lead.status,
    detail: data.detail ?? data.lostReason,
  });
  await createAuditLog({
    userId: actorId,
    action: event,
    entityType: "Lead",
    entityId: lead.id,
    oldValues: { status: existing.status, lostReason: existing.lostReason },
    newValues: { status: lead.status, lostReason: lead.lostReason },
  });

  if (data.status === LeadStatus.WON) {
    await notifyAdmins({
      type: "LEAD_WON",
      title: "Lead gewonnen",
      message: `${lead.name} wurde als gewonnen markiert.`,
      data: { leadId: lead.id, leadEmail: lead.email },
    });
  }
  if (data.status === LeadStatus.LOST) {
    await notifyAdmins({
      type: "LEAD_LOST",
      title: "Lead verloren",
      message: `${lead.name} wurde als verloren markiert.`,
      data: { leadId: lead.id, leadEmail: lead.email },
    });
  }

  return lead;
}

export async function addLeadNote(id: string, input: z.input<typeof crmNoteSchema>, actorId: string | undefined, scope: LeadScope) {
  const data = crmNoteSchema.parse(input);
  const lead = await prisma.lead.findFirst({ where: { AND: [{ id }, leadScopeWhere(scope), productionLeadWhere()] } });
  if (!lead) throw new Error("Lead wurde nicht gefunden.");

  const note = await prisma.leadNote.create({
    data: { leadId: id, authorId: actorId ?? null, body: data.body },
    include: { author: { select: { email: true } } },
  });
  await recordLeadActivity({ leadId: id, actorId, event: "lead.note_added", detail: data.body.slice(0, 240) });
  await createAuditLog({
    userId: actorId,
    action: "lead.note_added",
    entityType: "Lead",
    entityId: id,
    newValues: { noteId: note.id, body: note.body },
  });

  return note;
}

export async function assignLead(id: string, input: z.input<typeof crmAssignSchema>, actorId: string | undefined, scope: LeadScope) {
  const data = crmAssignSchema.parse(input);
  return updateCrmLead(id, { assignedToId: data.assignedToId ?? null }, actorId, scope);
}

export async function convertLeadToCustomer(id: string, actorId: string | undefined, scope: LeadScope) {
  const lead = await prisma.lead.findFirst({ where: { AND: [{ id }, leadScopeWhere(scope), productionLeadWhere()] }, include: { wonCustomer: true } });
  if (!lead) throw new Error("Lead wurde nicht gefunden.");

  if (lead.wonCustomerId) {
    await changeLeadStatus(id, { status: LeadStatus.WON, detail: "Bestehende Kundenverknüpfung bestätigt." }, actorId, scope);
    return { lead: await getCrmLead(id, scope), customerId: lead.wonCustomerId, created: false };
  }

  const existingUser = await prisma.user.findUnique({ where: { email: lead.email }, include: { customerProfile: true } });
  let customerId = existingUser?.customerProfile?.id;
  let tenantId = existingUser?.tenantId ?? existingUser?.customerProfile?.tenantId ?? null;
  let created = false;

  if (!customerId) {
    const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
    const customer = await prisma.$transaction(async (tx) => {
      const tenant = await createCustomerTenant(tx, lead.companyName || lead.name);
      const user = await tx.user.create({
        data: {
          email: lead.email,
          passwordHash,
          role: UserRole.CUSTOMER,
          status: UserStatus.EMAIL_UNVERIFIED,
          tenantId: tenant.id,
          customerProfile: {
            create: {
              tenantId: tenant.id,
              companyName: lead.companyName || lead.name,
              contactName: lead.name,
              phone: lead.phone || "offen",
              billingAddress: {
                street: "offen",
                houseNumber: "",
                postalCode: "",
                city: lead.city || "",
                country: "DE",
              },
            },
          },
        },
        include: { customerProfile: true },
      });
      await tx.tenantMembership.create({
        data: { tenantId: tenant.id, userId: user.id, role: "OWNER", status: "ACTIVE" },
      });
      return { profile: user.customerProfile, tenantId: tenant.id };
    });
    customerId = customer?.profile?.id;
    tenantId = customer?.tenantId ?? tenantId;
    created = true;
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: { wonCustomerId: customerId, status: LeadStatus.WON, ...(tenantId ? { tenantId } : {}) },
  });
  await recordLeadActivity({
    leadId: id,
    actorId,
    event: "lead.won",
    fromStatus: lead.status,
    toStatus: LeadStatus.WON,
    detail: created ? "Kunde wurde vorbereitet." : "Bestehender Kunde wurde verknüpft.",
    metadata: { customerId, created },
  });
  await createAuditLog({
    userId: actorId,
    action: "lead.converted",
    entityType: "Lead",
    entityId: id,
    oldValues: { status: lead.status, wonCustomerId: lead.wonCustomerId },
    newValues: { status: updated.status, wonCustomerId: updated.wonCustomerId, created },
  });
  await notifyAdmins({
    type: "LEAD_WON",
    title: "Lead als Kunde vorbereitet",
    message: `${lead.name} wurde mit einem Kundenkonto verknüpft.`,
    data: { leadId: lead.id, customerId },
  });

  return { lead: await getCrmLead(id, scope), customerId, created };
}

export async function getCrmFollowups(scope: LeadScope) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(todayEnd);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const baseWhere = { ...leadScopeWhere(scope), ...productionLeadWhere(), archivedAt: null, status: { notIn: [LeadStatus.WON, LeadStatus.LOST, LeadStatus.ARCHIVED] } };
  const include = { assignedTo: { select: { email: true } } };
  const [overdue, today, thisWeek, withoutFollowup] = await Promise.all([
    prisma.lead.findMany({ where: { ...baseWhere, nextFollowUpAt: { lt: todayStart } }, include, orderBy: { nextFollowUpAt: "asc" }, take: 100 }),
    prisma.lead.findMany({ where: { ...baseWhere, nextFollowUpAt: { gte: todayStart, lte: todayEnd } }, include, orderBy: { nextFollowUpAt: "asc" }, take: 100 }),
    prisma.lead.findMany({ where: { ...baseWhere, nextFollowUpAt: { gt: todayEnd, lte: weekEnd } }, include, orderBy: { nextFollowUpAt: "asc" }, take: 100 }),
    prisma.lead.findMany({ where: { ...baseWhere, nextFollowUpAt: null }, include, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return { overdue, today, thisWeek, withoutFollowup };
}
