import Link from "next/link";
import type { Metadata } from "next";
import { noIndexMetadata } from "@/app/seo";
import {
  DISTRIBUTOR_AREAS,
  MOBILITY_OPTIONS,
  SERVICE_RADII,
  WEEKDAYS,
  WORKING_TIMES,
} from "@/lib/constants";

export const metadata: Metadata = {
  title: "Verteilerkonto erstellen",
  description: "Bei FLYERO als Verteiler registrieren.",
  ...noIndexMetadata,
};

export default function DistributorRegisterPage() {
  return (
    <main className="authShell">
      <section className="authPanel">
        <Link href="/" className="authBack">Zur Startseite</Link>
        <h1>Verteilerregistrierung</h1>
        <p className="muted">Registrieren Sie sich für die Prüfung als Verteiler im FLYERO Netzwerk.</p>
        <form
          action="/api/auth/register-distributor"
          method="post"
          className="form grid"
        >
          <label>
            Vorname
            <input name="firstName" required />
          </label>
          <label>
            Nachname
            <input name="lastName" required />
          </label>
          <label>
            Geburtsdatum
            <input name="birthDate" type="date" required />
          </label>
          <label>
            E-Mail
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Telefon
            <input name="phone" type="tel" required />
          </label>
          <label>
            Straße
            <input name="street" required />
          </label>
          <label>
            Hausnummer
            <input name="houseNumber" required />
          </label>
          <label>
            PLZ
            <input name="postalCode" required />
          </label>
          <label>
            Ort
            <input name="city" required />
          </label>
          <label>
            Bundesland
            <input name="federalState" required />
          </label>

          <fieldset className="fieldset">
            <legend>Mobilität</legend>
            <div className="checkboxGrid">
              {MOBILITY_OPTIONS.map((option) => (
                <label key={option.value}>
                  <input name="mobilityTypes" type="checkbox" value={option.value} />
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
                  <input name="availabilityDays" type="checkbox" value={day} />
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
                  <input name="workingTimes" type="checkbox" value={time} />
                  {time}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Einsatzorte</legend>
            <div className="checkboxGrid">
              {DISTRIBUTOR_AREAS.map((area) => (
                <label key={area}>
                  <input name="preferredAreas" type="checkbox" value={area} />
                  {area}
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            Einsatzradius
            <select name="serviceRadiusKm" defaultValue="20" required>
              {SERVICE_RADII.map((radius) => (
                <option key={radius} value={radius}>
                  {radius} km
                </option>
              ))}
            </select>
          </label>
          <label>
            Steuernummer optional
            <input name="taxNumber" />
          </label>
          <label>
            Kontoinhaber optional
            <input name="bankAccountOwner" />
          </label>
          <label>
            IBAN optional
            <input name="iban" />
          </label>
          <label>
            Passwort
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </label>
          <label className="checkbox">
            <input name="acceptsTerms" type="checkbox" value="true" required />
            AGB und Datenschutz akzeptiert
          </label>
          <button type="submit">Verteilerkonto erstellen</button>
        </form>
        <p className="muted">
          Bereits registriert? <Link href="/login">Zum Login</Link>
        </p>
      </section>
    </main>
  );
}
