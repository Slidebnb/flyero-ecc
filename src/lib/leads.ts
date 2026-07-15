import { LeadStatus, LeadType } from "@prisma/client";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { leadScopeWhere, type LeadScope } from "@/lib/leadScope";
import { productionLeadWhere } from "@/lib/productionData";

const leadTypeValues = Object.values(LeadType) as [LeadType, ...LeadType[]];
const leadStatusValues = Object.values(LeadStatus) as [LeadStatus, ...LeadStatus[]];

const optionalText = z
  .preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().trim().max(180).optional());

export const createLeadSchema = z.object({
  type: z.enum(leadTypeValues).default(LeadType.CUSTOMER),
  name: z.string().trim().min(2).max(120),
  companyName: optionalText,
  email: z.string().trim().email().max(180),
  phone: optionalText,
  city: optionalText,
  message: z.string().trim().min(5).max(3000),
  source: z.string().trim().min(2).max(80).default("website"),
  sourceCampaign: optionalText,
});

export const updateLeadSchema = z.object({
  status: z.enum(leadStatusValues).optional(),
  adminNote: z
    .preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().max(3000).optional())
    .optional(),
  archive: z
    .preprocess((value) => value === true || value === "true" || value === "on" || value === "1", z.boolean())
    .optional(),
});

export async function createLead(input: z.input<typeof createLeadSchema>) {
  const data = createLeadSchema.parse(input);
  const lead = await prisma.lead.create({ data });
  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      event: "lead.created",
      toStatus: lead.status,
      detail: `Lead über ${lead.source} erstellt.`,
    },
  });

  await createAuditLog({
    action: "lead.created",
    entityType: "Lead",
    entityId: lead.id,
    newValues: {
      type: lead.type,
      status: lead.status,
      email: lead.email,
      city: lead.city,
      source: lead.source,
    },
  });

  await notifyAdmins({
    type: "LEAD_CREATED",
    title: "Neuer Lead eingegangen.",
    message: `${lead.name} hat eine Anfrage über ${lead.source} gesendet.`,
    data: {
      leadId: lead.id,
      leadType: lead.type,
      leadEmail: lead.email,
      name: lead.name,
      companyName: lead.companyName,
      phone: lead.phone,
      leadCity: lead.city,
      message: lead.message,
    },
  });

  return lead;
}

export async function updateLead(id: string, input: z.input<typeof updateLeadSchema>, userId: string | undefined, scope: LeadScope) {
  const data = updateLeadSchema.parse(input);
  const existing = await prisma.lead.findFirst({ where: { AND: [{ id }, leadScopeWhere(scope), productionLeadWhere()] } });

  if (!existing) {
    throw new Error("Lead wurde nicht gefunden.");
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.adminNote !== undefined ? { adminNote: data.adminNote || null } : {}),
      ...(data.archive !== undefined ? { archivedAt: data.archive ? new Date() : null } : {}),
    },
  });

  await createAuditLog({
    userId,
    action: "lead.updated",
    entityType: "Lead",
    entityId: lead.id,
    oldValues: {
      status: existing.status,
      adminNote: existing.adminNote,
      archivedAt: existing.archivedAt,
    },
    newValues: {
      status: lead.status,
      adminNote: lead.adminNote,
      archivedAt: lead.archivedAt,
    },
  });

  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      actorId: userId ?? null,
      event: lead.status !== existing.status ? "lead.status_changed" : "lead.updated",
      fromStatus: existing.status,
      toStatus: lead.status,
      detail: data.archive ? "Lead archiviert." : undefined,
    },
  });

  return lead;
}
