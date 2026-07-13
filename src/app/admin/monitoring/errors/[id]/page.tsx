import { ErrorSeverity, ErrorStatus } from "@prisma/client";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DataSection, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { formatDateTime } from "@/lib/format";
import { ignoreErrorLog, markErrorLogInProgress, resolveErrorLog } from "@/lib/monitoring";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { adminNavItems } from "@/app/admin/AdminPortalShell";

type PageProps = {
  params: Promise<{ id: string }>;
};

function severityTone(severity: ErrorSeverity) {
  if (severity === ErrorSeverity.CRITICAL) return "danger";
  if (severity === ErrorSeverity.HIGH) return "warning";
  return "neutral";
}

async function updateErrorAction(formData: FormData) {
  "use server";

  const session = await requirePermission(Permission.MONITORING_MANAGE);
  const id = String(formData.get("id") || "");
  const action = String(formData.get("action") || "");
  const resolutionNote = String(formData.get("resolutionNote") || "");

  if (action === "in_progress") {
    await markErrorLogInProgress(id, session.id, resolutionNote);
  } else if (action === "resolve") {
    await resolveErrorLog(id, session.id, resolutionNote);
  } else if (action === "ignore") {
    await ignoreErrorLog(id, session.id, resolutionNote);
  }

  revalidatePath(`/admin/monitoring/errors/${id}`);
  revalidatePath("/admin/monitoring");
  revalidatePath("/admin/monitoring/errors");
}

export default async function AdminMonitoringErrorDetailPage({ params }: PageProps) {
  await requirePermission(Permission.MONITORING_VIEW);
  const { id } = await params;
  const error = await prisma.errorLog.findUnique({
    where: { id },
    include: { resolvedBy: { select: { email: true, role: true } } },
  });

  if (!error) notFound();

  return (
    <PortalShell
      eyebrow="Admin Monitoring"
      title="Fehlerdetail"
      description="Stacktrace und Metadata bleiben ausschließlich im geschützten Adminbereich sichtbar."
      navItems={adminNavItems}
    >
      <section className="portalMetrics">
        <MetricLike label="Severity">
          <StatusBadge tone={severityTone(error.severity)}>{error.severity}</StatusBadge>
        </MetricLike>
        <MetricLike label="Status">
          <StatusBadge tone={error.status === ErrorStatus.RESOLVED ? "success" : error.status === ErrorStatus.IGNORED ? "neutral" : "warning"}>{error.status}</StatusBadge>
        </MetricLike>
        <MetricLike label="Quelle">{error.source}</MetricLike>
        <MetricLike label="Zeit">{formatDateTime(error.createdAt)}</MetricLike>
      </section>

      <DataSection title="Fehler">
        <div className="stack">
          <p><strong>Message:</strong> {error.message}</p>
          <p><strong>Gelöst/Ignoriert durch:</strong> {error.resolvedBy?.email ?? "-"}</p>
          <p><strong>Zeit:</strong> {formatDateTime(error.resolvedAt)}</p>
          <p><strong>Notiz:</strong> {error.resolutionNote || "-"}</p>
        </div>
      </DataSection>

      <DataSection title="Aktionen">
        <form className="form grid" action={updateErrorAction}>
          <input type="hidden" name="id" value={error.id} />
          <label className="full">
            Notiz
            <textarea name="resolutionNote" defaultValue={error.resolutionNote || ""} />
          </label>
          <div className="actions full">
            <button type="submit" name="action" value="in_progress">In Bearbeitung</button>
            <button type="submit" name="action" value="resolve">Lösen</button>
            <button type="submit" name="action" value="ignore">Ignorieren</button>
          </div>
        </form>
      </DataSection>

      <DataSection title="Stack">
        <pre className="codeBlock">{error.stack || "Kein Stacktrace gespeichert."}</pre>
      </DataSection>

      <DataSection title="Metadata">
        <pre className="codeBlock">{JSON.stringify(error.metadata ?? {}, null, 2)}</pre>
      </DataSection>

      <p className="muted">
        <Link className="textLink" href="/admin/monitoring/errors">Zurück zur Fehlerliste</Link>
      </p>
    </PortalShell>
  );
}

function MetricLike({ label, children }: { label: string; children: ReactNode }) {
  return (
    <article className="metricTile">
      <span>{label}</span>
      <div>{children}</div>
    </article>
  );
}
