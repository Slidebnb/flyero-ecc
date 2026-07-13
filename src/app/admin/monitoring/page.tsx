import { HealthStatus } from "@prisma/client";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { DataSection, MetricTile, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { formatDateTime } from "@/lib/format";
import { getMonitoringDashboard, runHealthCheck } from "@/lib/monitoring";
import { Permission, requirePermission } from "@/lib/permissions";
import { adminNavItems } from "@/app/admin/AdminPortalShell";

function healthTone(status?: HealthStatus | null) {
  if (status === HealthStatus.OK) return "success";
  if (status === HealthStatus.DOWN) return "danger";
  return "warning";
}

async function runHealthCheckAction() {
  "use server";

  const session = await requirePermission(Permission.MONITORING_MANAGE);
  await runHealthCheck(session.id);
  revalidatePath("/admin/monitoring");
}

export default async function AdminMonitoringPage() {
  await requirePermission(Permission.MONITORING_VIEW);
  const dashboard = await getMonitoringDashboard();
  const latest = dashboard.latestHealth;
  const failedQueue = dashboard.queueCounts.find((item) => item.status === "FAILED")?._count.status ?? 0;
  const retryQueue = dashboard.queueCounts.find((item) => item.status === "RETRY")?._count.status ?? 0;

  return (
    <PortalShell
      eyebrow="Admin Monitoring"
      title="Systemstatus"
      description="Zentrale Übersicht für Health Checks, Fehlerlogs, Background Jobs und Queue-Zustände."
      navItems={adminNavItems}
    >
      <section className="portalMetrics">
        <MetricTile label="Gesamtstatus" value={latest?.status ?? "OK"} tone={healthTone(latest?.status)} />
        <MetricTile label="Offene Fehler" value={dashboard.openErrors} tone={dashboard.openErrors ? "warning" : "success"} />
        <MetricTile label="Kritische Fehler" value={dashboard.criticalOpenErrors.length} tone={dashboard.criticalOpenErrors.length ? "danger" : "success"} />
        <MetricTile label="Fehlgeschlagene Jobs" value={dashboard.failedJobs.length} tone={dashboard.failedJobs.length ? "warning" : "success"} />
        <MetricTile label="Queue FAILED" value={failedQueue} tone={failedQueue ? "danger" : "success"} />
        <MetricTile label="Queue RETRY" value={retryQueue} tone={retryQueue ? "warning" : "success"} />
        <MetricTile label="Stripe" value={latest?.stripeStatus ?? "OK"} tone={healthTone(latest?.stripeStatus)} />
        <MetricTile label="Google Maps" value={latest?.googleMapsStatus ?? "OK"} tone={healthTone(latest?.googleMapsStatus)} />
        <MetricTile label="Storage" value={latest?.storageStatus ?? "OK"} tone={healthTone(latest?.storageStatus)} />
        <MetricTile label="Datenbank" value={latest?.databaseStatus ?? "OK"} tone={healthTone(latest?.databaseStatus)} />
      </section>

      <section className="actionPanel">
        <div>
          <h2>Health Check</h2>
          <p>Letzter Check: {formatDateTime(latest?.checkedAt)}. Die öffentliche API zeigt nur den Gesamtstatus.</p>
        </div>
        <form action={runHealthCheckAction}>
          <button type="submit">Health Check auslösen</button>
        </form>
      </section>

      <DataSection title="Offene kritische Fehler">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Quelle</th>
                <th>Fehler</th>
                <th>Status</th>
                <th>Zeit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dashboard.criticalOpenErrors.map((error) => (
                <tr key={error.id}>
                  <td>{error.source}</td>
                  <td>{error.message}</td>
                  <td><StatusBadge tone="danger">{error.status}</StatusBadge></td>
                  <td>{formatDateTime(error.createdAt)}</td>
                  <td><Link className="textLink" href={`/admin/monitoring/errors/${error.id}`}>Öffnen</Link></td>
                </tr>
              ))}
              {!dashboard.criticalOpenErrors.length ? (
                <tr><td colSpan={5}>Keine offenen kritischen Fehler.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DataSection>

      <DataSection title="Fehler nach Quelle">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Quelle</th>
                <th>Offene Fehler</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.errorsBySource.map((item) => (
                <tr key={item.source}>
                  <td>{item.source}</td>
                  <td>{item._count.source}</td>
                </tr>
              ))}
              {!dashboard.errorsBySource.length ? <tr><td colSpan={2}>Keine offenen Fehler.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </DataSection>

      <DataSection title="Letzte Health Checks">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Datenbank</th>
                <th>Storage</th>
                <th>Stripe</th>
                <th>Google</th>
                <th>E-Mail</th>
                <th>Queue</th>
                <th>Zeit</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.recentHealthChecks.map((check) => (
                <tr key={check.id}>
                  <td><StatusBadge tone={healthTone(check.status)}>{check.status}</StatusBadge></td>
                  <td>{check.databaseStatus}</td>
                  <td>{check.storageStatus}</td>
                  <td>{check.stripeStatus}</td>
                  <td>{check.googleMapsStatus}</td>
                  <td>{check.emailStatus}</td>
                  <td>{check.queueStatus}</td>
                  <td>{formatDateTime(check.checkedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataSection>

      <DataSection title="Fehlgeschlagene Background Jobs">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Fehler</th>
                <th>Zeit</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.failedJobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.jobType}</td>
                  <td>{job.errorMessage ?? "-"}</td>
                  <td>{formatDateTime(job.startedAt)}</td>
                </tr>
              ))}
              {!dashboard.failedJobs.length ? <tr><td colSpan={3}>Keine fehlgeschlagenen Jobs.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </PortalShell>
  );
}
