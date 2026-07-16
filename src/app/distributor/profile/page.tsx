import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MOBILITY_OPTIONS,
  SERVICE_RADII,
  WEEKDAYS,
  WORKING_TIMES,
} from "@/lib/constants";
import { asObject, formatDate } from "@/lib/format";

function isChecked(values: string[], value: string) {
  return values.includes(value);
}

export default async function DistributorProfilePage() {
  const session = await requireRole([UserRole.DISTRIBUTOR]);
  const profile = await prisma.distributorProfile.findUnique({
    where: { userId: session.id },
    include: { user: true },
  });

  if (!profile) {
    return <main className="appShell">Verteilerprofil wurde nicht gefunden.</main>;
  }

  const address = asObject(profile.address);
  const availability = asObject(profile.availability);
  const availabilityDays = Array.isArray(availability.days)
    ? availability.days.map(String)
    : [];
  const bankAccount = asObject(profile.bankAccount);

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Verteilerportal</p>
          <h1>Profil</h1>
          <p className="muted">Registriert seit {formatDate(profile.createdAt)}</p>
        </div>
        <nav className="nav">
          <Link href="/distributor/dashboard">Dashboard</Link>
        </nav>
      </header>

      <section className="panel">
        <form action="/api/distributor/profile" method="post" className="form grid">
          <label>
            Vorname
            <input name="firstName" defaultValue={profile.firstName} required />
          </label>
          <label>
            Nachname
            <input name="lastName" defaultValue={profile.lastName} required />
          </label>
          <label>
            Geburtsdatum
            <input
              name="birthDate"
              type="date"
              defaultValue={profile.birthDate.toISOString().slice(0, 10)}
              required
            />
          </label>
          <label>
            E-Mail
            <input value={profile.user.email} disabled />
          </label>
          <label>
            Telefon
            <input name="phone" defaultValue={profile.phone} required />
          </label>
          <label>
            Straße
            <input name="street" defaultValue={String(address.street || "")} required />
          </label>
          <label>
            Hausnummer
            <input name="houseNumber" defaultValue={String(address.houseNumber || "")} required />
          </label>
          <label>
            PLZ
            <input name="postalCode" defaultValue={String(address.postalCode || "")} required />
          </label>
          <label>
            Ort
            <input name="city" defaultValue={String(address.city || "")} required />
          </label>
          <label>
            Bundesland
            <input name="federalState" defaultValue={profile.federalState} required />
          </label>

          <fieldset className="fieldset">
            <legend>Mobilität</legend>
            <div className="checkboxGrid">
              {MOBILITY_OPTIONS.map((option) => (
                <label key={option.value}>
                  <input
                    name="mobilityTypes"
                    type="checkbox"
                    value={option.value}
                    defaultChecked={isChecked(profile.mobilityTypes, option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Verfügbarkeit</legend>
            <div className="checkboxGrid">
              {WEEKDAYS.map((day) => (
                <label key={day}>
                  <input
                    name="availabilityDays"
                    type="checkbox"
                    value={day}
                    defaultChecked={isChecked(availabilityDays, day)}
                  />
                  {day}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Arbeitszeiten</legend>
            <div className="checkboxGrid">
              {WORKING_TIMES.map((time) => (
                <label key={time}>
                  <input
                    name="workingTimes"
                    type="checkbox"
                    value={time}
                    defaultChecked={isChecked(profile.workingTimes, time)}
                  />
                  {time}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Einsatzorte</legend>
            <label>
              Städte, PLZ-Bereiche oder deutschlandweit
              <textarea name="preferredAreas" rows={3} required defaultValue={profile.preferredAreas.join(", ")} />
            </label>
            <p className="muted">Mehrere Angaben bitte mit Komma oder Zeilenumbruch trennen.</p>
          </fieldset>

          <label>
            Einsatzradius
            <select name="serviceRadiusKm" defaultValue={profile.serviceRadiusKm} required>
              {SERVICE_RADII.map((radius) => (
                <option key={radius} value={radius}>
                  {radius} km
                </option>
              ))}
            </select>
          </label>
          <label>
            Steuernummer optional
            <input name="taxNumber" defaultValue={profile.taxNumber || ""} />
          </label>
          <label>
            Kontoinhaber optional
            <input name="bankAccountOwner" defaultValue={String(bankAccount.owner || "")} />
          </label>
          <label>
            IBAN optional
            <input name="iban" defaultValue={String(bankAccount.iban || "")} />
          </label>
          <button type="submit">Profil speichern</button>
        </form>
      </section>
    </main>
  );
}
