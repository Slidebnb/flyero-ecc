import { LeadStatus, LeadType, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { notifyAdmins, notifyEmailRecipient } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { leadScopeWhere, type LeadScope } from "@/lib/leadScope";
import { productionLeadWhere } from "@/lib/productionData";

const leadTypeValues = Object.values(LeadType) as [LeadType, ...LeadType[]];
const leadStatusValues = Object.values(LeadStatus) as [LeadStatus, ...LeadStatus[]];

const optionalText = z
  .preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().trim().max(180).optional());

const optionalInteger = z.preprocess(
  (value) => (value === undefined || value === null || value === "" ? undefined : Number(value)),
  z.number().int().min(1).max(1_000_000).optional(),
);

const optionalBoolean = z.preprocess(
  (value) => (value === undefined || value === null || value === "" ? undefined : value === true || value === "true" || value === "on" || value === "1"),
  z.boolean().optional(),
);

export const createLeadSchema = z.object({
  type: z.enum(leadTypeValues).default(LeadType.CUSTOMER),
  name: z.string().trim().min(2).max(120),
  companyName: optionalText,
  email: z.string().trim().email().max(180),
  phone: optionalText,
  city: optionalText,
  postalCode: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().regex(/^\d{5}$/, "Bitte gib eine fünfstellige PLZ ein.").optional()),
  streetAddress: optionalText,
  flyerQuantity: optionalInteger,
  startDate: optionalText,
  endDate: optionalText,
  flexibleSchedule: optionalBoolean,
  flyersAlreadyPrinted: optionalBoolean,
  flyerFormat: optionalText,
  targetGroup: optionalText,
  distributionMode: optionalText,
  campaignGoal: optionalText,
  idempotencyKey: z.string().trim().min(16).max(120).optional(),
  message: z.string().trim().min(5).max(3000),
  source: z.string().trim().min(2).max(80).default("website"),
  sourceCampaign: optionalText,
}).superRefine((data, context) => {
  if (data.source !== "verteilung-anfragen") return;
  const requiredFields: Array<[keyof typeof data, string]> = [
    ["companyName", "Bitte gib deine Firma an."],
    ["phone", "Bitte gib eine Telefonnummer an."],
    ["city", "Bitte gib den Ort des Verteilgebiets an."],
    ["postalCode", "Bitte gib eine fünfstellige PLZ an."],
    ["flyerQuantity", "Bitte gib die Flyeranzahl an."],
    ["startDate", "Bitte gib den gewünschten Start an."],
    ["endDate", "Bitte gib das gewünschte Ende an."],
    ["flyersAlreadyPrinted", "Bitte gib an, ob die Flyer bereits gedruckt sind."],
    ["targetGroup", "Bitte gib die Zielgruppe an."],
    ["distributionMode", "Bitte gib die Verteilart an."],
  ];
  for (const [field, message] of requiredFields) {
    const value = data[field];
    if (value === undefined || value === null || value === "") {
      context.addIssue({ code: "custom", path: [field], message });
    }
  }
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
  if (data.idempotencyKey) {
    const existing = await prisma.lead.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
    if (existing) return existing;
  }

  const { postalCode, streetAddress, flyerQuantity, startDate, endDate, flexibleSchedule, flyersAlreadyPrinted, flyerFormat, targetGroup, distributionMode, campaignGoal, idempotencyKey, ...leadData } = data;
  let lead: Awaited<ReturnType<typeof prisma.lead.create>>;
  try {
    lead = await prisma.lead.create({
      data: {
        ...leadData,
        inquiryNumber: `ANF-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        idempotencyKey,
        expectedFlyerQuantity: flyerQuantity,
        inquiryData: {
          postalCode: postalCode ?? null,
          streetAddress: streetAddress ?? null,
          flyerQuantity: flyerQuantity ?? null,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          flexibleSchedule: flexibleSchedule ?? null,
          flyersAlreadyPrinted: flyersAlreadyPrinted ?? null,
          flyerFormat: flyerFormat ?? null,
          targetGroup: targetGroup ?? null,
          distributionMode: distributionMode ?? null,
          campaignGoal: campaignGoal ?? null,
        },
      },
    });
  } catch (error) {
    if (idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrentLead = await prisma.lead.findUnique({ where: { idempotencyKey } });
      if (concurrentLead) return concurrentLead;
    }
    throw error;
  }
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
      inquiryNumber: lead.inquiryNumber,
      postalCode,
      streetAddress,
      flyerQuantity,
      startDate,
      endDate,
      flexibleSchedule,
      flyersAlreadyPrinted,
      flyerFormat,
      targetGroup,
      distributionMode,
      campaignGoal,
    },
  });

  await notifyEmailRecipient({
    recipientEmail: lead.email,
    type: "INQUIRY_RECEIVED_CUSTOMER",
    subject: "Ihre FLYERO Anfrage ist eingegangen",
    body: `Vielen Dank für Ihre Anfrage. Ihre Anfragenummer lautet ${lead.inquiryNumber ?? lead.id}. Wir prüfen Gebiet, Ablauf und Preis und melden uns schnellstmöglich.`,
    data: {
      inquiryNumber: lead.inquiryNumber,
      leadId: lead.id,
      leadEmail: lead.email,
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
