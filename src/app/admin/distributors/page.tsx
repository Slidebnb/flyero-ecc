import Link from "next/link";
import { DistributorReviewStatus, UserRole } from "@prisma/client";
import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_DISTRIBUTOR_FILTERS,
  DISTRIBUTOR_STATUS_LABELS,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function AdminDistributorsPage({ searchParams }: PageProps) {
  await requireRole([UserRole.ADMIN]);
  const params = await searchParams;
  const selectedStatus = ADMIN_DISTRIBUTOR_FILTERS.includes(
    params.status as (typeof ADMIN_DISTRIBUTOR_FILTERS)[number],
  )
    ? (params.status as DistributorReviewStatus)
    : undefined;

  const distributors = await prisma.distributorProfile.findMany({
    where: selectedStatus ? { reviewStatus: selectedStatus } : undefined,
    include: { user: true },
    orderBy: [{ reviewStatus: "asc" }, { createdAt: "desc" }],
  });

  return (
    <AdminPortalShell eyebrow="Adminbereich" title="Verteilerprüfung">

      <section className="panel stack">
        <div className="nav">
          <Link href="/admin/distributors">Alle</Link>
          {ADMIN_DISTRIBUTOR_FILTERS.map((status) => (
            <Link key={status} href={`/admin/distributors?status=${status}`}>
              {DISTRIBUTOR_STATUS_LABELS[status]}
            </Link>
          ))}
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>E-Mail</th>
                <th>Einsatzorte</th>
                <th>Registriert</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {distributors.map((profile) => (
                <tr key={profile.id}>
                  <td>
                    {profile.firstName} {profile.lastName}
                  </td>
                  <td>{DISTRIBUTOR_STATUS_LABELS[profile.reviewStatus]}</td>
                  <td>{profile.user.email}</td>
                  <td>{profile.preferredAreas.join(", ")}</td>
                  <td>{formatDate(profile.createdAt)}</td>
                  <td>
                    <Link className="textLink" href={`/admin/distributors/${profile.id}`}>
                      Öffnen
                    </Link>
                  </td>
                </tr>
              ))}
              {distributors.length === 0 ? (
                <tr>
                  <td colSpan={6}>Keine Verteiler in diesem Filter.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPortalShell>
  );
}
