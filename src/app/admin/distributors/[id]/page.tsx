import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DISTRIBUTOR_STATUS_LABELS } from "@/lib/constants";
import { asObject, formatAddress, formatDate } from "@/lib/format";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminDistributorDetailPage({ params }: PageProps) {
  await requireRole([UserRole.ADMIN]);
  const { id } = await params;
  const profile = await prisma.distributorProfile.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!profile) {
    notFound();
  }

  const availability = asObject(profile.availability);
  const bankAccount = asObject(profile.bankAccount);
  const days = Array.isArray(availability.days)
    ? availability.days.map(String).join(", ")
    : "-";

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Adminbereich</p>
          <h1>
            {profile.firstName} {profile.lastName}
          </h1>
          <span className="badge">{DISTRIBUTOR_STATUS_LABELS[profile.reviewStatus]}</span>
        </div>
        <nav className="nav">
          <Link href="/admin/distributors">Zur Liste</Link>
          <Link href="/admin/dashboard">Dashboard</Link>
        </nav>
      </header>

      <section className="gridCards">
        <article className="card">
          <strong>{profile.preferredAreas.length}</strong>
          <span>Einsatzorte</span>
        </article>
        <article className="card">
          <strong>{profile.serviceRadiusKm} km</strong>
          <span>Radius</span>
        </article>
        <article className="card">
          <strong>{profile.mobilityTypes.length}</strong>
          <span>Mobilitätsarten</span>
        </article>
        <article className="card">
          <strong>{formatDate(profile.createdAt)}</strong>
          <span>Registriert</span>
        </article>
      </section>

      <section className="panel stack" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Profildaten</h2>
        <div className="tableWrap">
          <table>
            <tbody>
              <tr>
                <th>E-Mail</th>
                <td>{profile.user.email}</td>
              </tr>
              <tr>
                <th>Telefon</th>
                <td>{profile.phone}</td>
              </tr>
              <tr>
                <th>Geburtsdatum</th>
                <td>{formatDate(profile.birthDate)}</td>
              </tr>
              <tr>
                <th>Adresse</th>
                <td style={{ whiteSpace: "pre-line" }}>{formatAddress(profile.address)}</td>
              </tr>
              <tr>
                <th>Bundesland</th>
                <td>{profile.federalState}</td>
              </tr>
              <tr>
                <th>Mobilität</th>
                <td>{profile.mobilityTypes.join(", ")}</td>
              </tr>
              <tr>
                <th>Verfügbarkeit</th>
                <td>{days}</td>
              </tr>
              <tr>
                <th>Arbeitszeiten</th>
                <td>{profile.workingTimes.join(", ")}</td>
              </tr>
              <tr>
                <th>Einsatzorte</th>
                <td>{profile.preferredAreas.join(", ")}</td>
              </tr>
              <tr>
                <th>Ausweis</th>
                <td>{profile.idDocumentStatus}</td>
              </tr>
              <tr>
                <th>Führerschein</th>
                <td>{profile.driverLicenseStatus}</td>
              </tr>
              <tr>
                <th>Gewerbenachweis</th>
                <td>{profile.businessDocumentStatus}</td>
              </tr>
              <tr>
                <th>Steuernummer</th>
                <td>{profile.taxNumber || "-"}</td>
              </tr>
              <tr>
                <th>Bankverbindung</th>
                <td>
                  {[bankAccount.owner, bankAccount.iban].filter(Boolean).join(" / ") ||
                    "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Status ändern</h2>
        <form action={`/api/admin/distributors/${profile.id}/status`} method="post" className="form">
          <label>
            Adminnotiz
            <textarea name="adminNotes" defaultValue={profile.adminNotes || ""} />
          </label>
          <div className="actions">
            <button name="reviewStatus" value="APPROVED" type="submit">
              Freigeben
            </button>
            <button name="reviewStatus" value="REJECTED" type="submit">
              Ablehnen
            </button>
            <button name="reviewStatus" value="PAUSED" type="submit">
              Pausieren
            </button>
            <button name="reviewStatus" value="BANNED" type="submit">
              Sperren
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
