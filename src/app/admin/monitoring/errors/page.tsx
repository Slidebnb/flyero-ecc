import { ErrorSeverity, ErrorStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { DataSection, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { adminNavItems } from "@/app/admin/AdminPortalShell";

type SearchParams = Promise<{
  status?: string;
  severity?: string;
  source?: string;
}>;

function severityTone(severity: ErrorSeverity) {
  if (severity === ErrorSeverity.CRITICAL) return "danger";
  if (severity === ErrorSeverity.HIGH) return "warning";
  return "neutral";
}

export default async function AdminMonitoringErrorsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const params = await searchParams;
  const status = params.status && Object.values(ErrorStatus).includes(params.status as ErrorStatus) ? params.status as ErrorStatus : undefined;
  const severity = params.severity && Object.values(ErrorSeverity).includes(params.severity as ErrorSeverity) ? params.severity as ErrorSeverity : undefined;
  const source = params.source?.trim();

  const errors = await prisma.errorLog.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(severity ? { severity } : {}),
      ...(source ? { source: { contains: source, mode: "insensitive" } } : {}),
    },
    include: { resolvedBy: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <PortalShell
      eyebrow="Admin Monitoring"
      title="Fehlerlogs"
      description="Zentrale Liste für technische Fehler, Status und Bearbeitung."
      navItems={adminNavItems}
    >
      <DataSection title="Filter">
        <form className="form grid" method="get">
          <label>
            Status
            <select name="status" defaultValue={status || ""}>
              <option value="">Alle Status</option>
              {Object.values(ErrorStatus).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Severity
            <select name="severity" defaultValue={severity || ""}>
              <option value="">Alle Stufen</option>
              {Object.values(ErrorSeverity).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Quelle
            <input name="source" defaultValue={source || ""} />
          </label>
          <button type="submit">Filtern</button>
        </form>
      </DataSection>

      <DataSection title="Fehler">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Quelle</th>
                <th>Message</th>
                <th>Status</th>
                <th>Zeit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {errors.map((error) => (
                <tr key={error.id}>
                  <td><StatusBadge tone={severityTone(error.severity)}>{error.severity}</StatusBadge></td>
                  <td>{error.source}</td>
                  <td>{error.message}</td>
                  <td>{error.status}</td>
                  <td>{formatDateTime(error.createdAt)}</td>
                  <td><Link className="textLink" href={`/admin/monitoring/errors/${error.id}`}>Öffnen</Link></td>
                </tr>
              ))}
              {!errors.length ? <tr><td colSpan={6}>Keine Fehler für diesen Filter.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </PortalShell>
  );
}
