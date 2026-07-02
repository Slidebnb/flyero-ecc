import { notFound, redirect } from "next/navigation";
import { LeadPriority, LeadStatus, UserRole } from "@prisma/client";
import { ActionPanel, DataSection, EmptyState, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { addLeadNote, changeLeadStatus, convertLeadToCustomer, getAssignableUsers, getCrmLead, updateCrmLead } from "@/lib/crm";
import { formatDateTime } from "@/lib/format";

type LeadDetailProps = {
  params: Promise<{ id: string }>;
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Neu",
  CONTACTED: "Kontaktiert",
  QUALIFIED: "Qualifiziert",
  OFFER_SENT: "Angebot gesendet",
  TEST_ORDER_PLANNED: "Testauftrag geplant",
  WON: "Gewonnen",
  LOST: "Verloren",
  ARCHIVED: "Archiviert",
};

const PRIORITY_LABELS: Record<LeadPriority, string> = {
  LOW: "Niedrig",
  NORMAL: "Normal",
  HIGH: "Hoch",
  URGENT: "Dringend",
};

function badgeTone(status: LeadStatus) {
  if (status === "WON") return "success" as const;
  if (status === "LOST" || status === "ARCHIVED") return "danger" as const;
  if (status === "NEW" || status === "OFFER_SENT" || status === "TEST_ORDER_PLANNED") return "warning" as const;
  return "neutral" as const;
}

async function updateLeadAction(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const id = String(formData.get("id") || "");
  await updateCrmLead(id, {
    priority: String(formData.get("priority") || "") as LeadPriority,
    assignedToId: String(formData.get("assignedToId") || "") || null,
    nextFollowUpAt: String(formData.get("nextFollowUpAt") || "") || null,
    estimatedOrderVolume: String(formData.get("estimatedOrderVolume") || "") || null,
    expectedFlyerQuantity: String(formData.get("expectedFlyerQuantity") || "") || null,
    notes: String(formData.get("notes") || "") || null,
  }, session.id);
  redirect(`/admin/crm/leads/${id}`);
}

async function statusAction(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const id = String(formData.get("id") || "");
  await changeLeadStatus(id, {
    status: String(formData.get("status") || "") as LeadStatus,
    detail: String(formData.get("detail") || "") || undefined,
    lostReason: String(formData.get("lostReason") || "") || undefined,
  }, session.id);
  redirect(`/admin/crm/leads/${id}`);
}

async function noteAction(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const id = String(formData.get("id") || "");
  await addLeadNote(id, { body: String(formData.get("body") || "") }, session.id);
  redirect(`/admin/crm/leads/${id}`);
}

async function convertAction(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const id = String(formData.get("id") || "");
  await convertLeadToCustomer(id, session.id);
  redirect(`/admin/crm/leads/${id}`);
}

export default async function LeadDetailPage({ params }: LeadDetailProps) {
  await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const { id } = await params;
  const [lead, users] = await Promise.all([getCrmLead(id), getAssignableUsers()]);
  if (!lead) notFound();

  const actionStatuses: LeadStatus[] = ["CONTACTED", "QUALIFIED", "OFFER_SENT", "TEST_ORDER_PLANNED", "WON", "LOST", "ARCHIVED"];

  return (
    <PortalShell
      eyebrow="CRM Lead"
      title={lead.companyName || lead.name}
      description={`${lead.email} / ${lead.city || "Ort offen"} / Quelle: ${lead.source}`}
      navItems={[
        { href: "/admin/crm", label: "CRM" },
        { href: "/admin/crm/followups", label: "Follow-ups" },
        { href: "/admin/analytics", label: "Analytics" },
      ]}
    >
      <section className="detailGrid">
        <ActionPanel title="Stammdaten">
          <p><strong>Status:</strong> <StatusBadge tone={badgeTone(lead.status)}>{STATUS_LABELS[lead.status]}</StatusBadge></p>
          <p><strong>Name:</strong> {lead.name}</p>
          <p><strong>Firma:</strong> {lead.companyName || "-"}</p>
          <p><strong>E-Mail:</strong> {lead.email}</p>
          <p><strong>Telefon:</strong> {lead.phone || "-"}</p>
          <p><strong>Stadt:</strong> {lead.city || "-"}</p>
          <p><strong>Quelle:</strong> {lead.source}{lead.sourceCampaign ? ` / ${lead.sourceCampaign}` : ""}</p>
          <p><strong>Gewonnener Kunde:</strong> {lead.wonCustomer?.companyName ?? "-"}</p>
        </ActionPanel>

        <ActionPanel title="Pipeline bearbeiten" description="Priorität, Verantwortlichen, Follow-up und Potenzial pflegen.">
          <form action={updateLeadAction} className="form grid">
            <input type="hidden" name="id" value={lead.id} />
            <label>Priorität<select name="priority" defaultValue={lead.priority}>
              {Object.values(LeadPriority).map((priority) => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}
            </select></label>
            <label>Verantwortlich<select name="assignedToId" defaultValue={lead.assignedToId ?? ""}>
              <option value="">Niemand</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
            </select></label>
            <label>Follow-up<input name="nextFollowUpAt" type="datetime-local" defaultValue={lead.nextFollowUpAt ? lead.nextFollowUpAt.toISOString().slice(0, 16) : ""} /></label>
            <label>Geschätztes Volumen<input name="estimatedOrderVolume" type="number" min="0" step="0.01" defaultValue={lead.estimatedOrderVolume?.toString() ?? ""} /></label>
            <label>Erwartete Flyerzahl<input name="expectedFlyerQuantity" type="number" min="0" defaultValue={lead.expectedFlyerQuantity ?? ""} /></label>
            <label className="full">Interne Notizen<textarea name="notes" defaultValue={lead.notes ?? lead.adminNote ?? ""} /></label>
            <button type="submit">Pipeline speichern</button>
          </form>
        </ActionPanel>
      </section>

      <DataSection title="Nachricht und mögliche Auftragsmenge">
        <div className="gridTwo">
          <article className="card">
            <strong>Anfrage</strong>
            <p>{lead.message}</p>
          </article>
          <article className="card">
            <strong>Potenzial</strong>
            <p>Flyerzahl: {lead.expectedFlyerQuantity ?? "offen"}</p>
            <p>Volumen: {lead.estimatedOrderVolume ? `${lead.estimatedOrderVolume.toString()} EUR` : "offen"}</p>
            <p>Letzter Kontakt: {lead.lastContactedAt ? formatDateTime(lead.lastContactedAt) : "offen"}</p>
            <p>Nächstes Follow-up: {lead.nextFollowUpAt ? formatDateTime(lead.nextFollowUpAt) : "offen"}</p>
          </article>
        </div>
      </DataSection>

      <ActionPanel title="Aktionen">
        <div className="crmActionGrid">
          {actionStatuses.map((status) => (
            <form action={statusAction} key={status}>
              <input type="hidden" name="id" value={lead.id} />
              <input type="hidden" name="status" value={status} />
              {status === "LOST" ? <input name="lostReason" placeholder="Grund optional" /> : null}
              <button type="submit">{STATUS_LABELS[status]}</button>
            </form>
          ))}
          <form action={convertAction}>
            <input type="hidden" name="id" value={lead.id} />
            <button type="submit">Als Kunde anlegen</button>
          </form>
        </div>
      </ActionPanel>

      <DataSection title="Notizen">
        <form action={noteAction} className="form">
          <input type="hidden" name="id" value={lead.id} />
          <label>Neue Notiz<textarea name="body" required /></label>
          <button type="submit">Notiz speichern</button>
        </form>
        <div className="crmTimeline">
          {lead.leadNotes.map((note) => (
            <article key={note.id}>
              <strong>{note.author?.email ?? "System"}</strong>
              <span>{formatDateTime(note.createdAt)}</span>
              <p>{note.body}</p>
            </article>
          ))}
          {lead.leadNotes.length === 0 ? <EmptyState title="Noch keine Notizen." /> : null}
        </div>
      </DataSection>

      <DataSection title="Statushistorie und Aktivitäten">
        <div className="crmTimeline">
          {lead.activities.map((activity) => (
            <article key={activity.id}>
              <strong>{activity.event}</strong>
              <span>{formatDateTime(activity.createdAt)} / {activity.actor?.email ?? "System"}</span>
              <p>{activity.fromStatus ? `${STATUS_LABELS[activity.fromStatus]} -> ${activity.toStatus ? STATUS_LABELS[activity.toStatus] : "-"}` : STATUS_LABELS[activity.toStatus ?? lead.status]}</p>
              {activity.detail ? <p>{activity.detail}</p> : null}
            </article>
          ))}
          {lead.activities.length === 0 ? <EmptyState title="Noch keine Aktivitäten." /> : null}
        </div>
      </DataSection>
    </PortalShell>
  );
}
