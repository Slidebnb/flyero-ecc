import Link from "next/link";
import { UserRole } from "@prisma/client";
import { DistributionAreaEditor } from "@/app/components/DistributionAreaEditor";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewCustomerOrderPage() {
  await requireRole([UserRole.CUSTOMER]);
  const today = new Date().toISOString().slice(0, 10);
  const areas = await prisma.distributionArea.findMany({
    where: { reusable: true, status: "ACTIVE" },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      city: true,
      postalCode: true,
      district: true,
      estimatedHouseholds: true,
      estimatedFlyers: true,
      estimatedDistanceMeters: true,
      coverageAreaSqm: true,
      geoJson: true,
      centerLat: true,
      centerLng: true,
      radiusMeters: true,
    },
  });
  const areaOptions = areas.map((area) => ({
    ...area,
    coverageAreaSqm: area.coverageAreaSqm ? Number(area.coverageAreaSqm) : null,
    centerLat: area.centerLat ? Number(area.centerLat) : null,
    centerLng: area.centerLng ? Number(area.centerLng) : null,
  }));

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Kundenportal</p>
          <h1>Neuen Auftrag erstellen</h1>
        </div>
        <nav className="nav">
          <Link href="/customer/orders">Meine Aufträge</Link>
          <Link href="/customer/dashboard">Dashboard</Link>
        </nav>
      </header>

      <section className="panel">
        <form action="/api/customer/orders" method="post" className="form grid">
          <fieldset className="fieldset">
            <legend>Schritt 1: Leistung</legend>
            <div className="checkboxGrid">
              <label>
                <input name="serviceType" type="radio" value="FLYER_DISTRIBUTION" defaultChecked />
                Flyerverteilung
              </label>
              <label>
                <input name="serviceType" type="radio" value="DOOR_HANGER" disabled />
                Türhänger später
              </label>
              <label>
                <input name="serviceType" type="radio" value="BROCHURE" disabled />
                Prospekte später
              </label>
              <label>
                <input name="serviceType" type="radio" value="MAGAZINE" disabled />
                Magazine später
              </label>
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Schritt 2: Verteilgebiet</legend>
            <DistributionAreaEditor areas={areaOptions} />
            <div className="form grid">
              <label>
                Stadt
                <input name="city" required />
              </label>
              <label>
                PLZ
                <input name="postalCode" required />
              </label>
              <label>
                Straße
                <input name="street" />
              </label>
              <label>
                Hausnummer optional
                <input name="houseNumber" />
              </label>
              <label className="full">
                Gebietsname
                <input name="targetAreaName" placeholder="z.B. Koblenz-Mitte" required />
              </label>
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Schritt 3: Flyer</legend>
            <div className="form grid">
              <label>
                Anzahl Flyer
                <input name="flyerQuantity" type="number" min="1" required />
              </label>
              <label>
                Anzahl Haushalte optional
                <input name="estimatedHouseholds" type="number" min="1" />
              </label>
              <label className="checkbox">
                <input name="flyerSource" type="radio" value="CUSTOMER_OWN" defaultChecked />
                Ich habe bereits Flyer
              </label>
              <label className="checkbox">
                <input name="flyerSource" type="radio" value="PRINT_SERVICE" />
                Ich benötige Druck
              </label>
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Schritt 4: Termin</legend>
            <div className="form grid">
              <label>
                Wunschtermin
                <input name="preferredStartDate" type="date" defaultValue={today} required />
              </label>
              <label>
                Bis spätestens
                <input name="preferredEndDate" type="date" defaultValue={today} required />
              </label>
              <label className="checkbox">
                <input name="flexibleScheduling" type="checkbox" value="true" />
                Flexible Terminplanung
              </label>
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Schritt 5: Zusatzinfos</legend>
            <div className="form grid">
              <label>
                Kontaktperson
                <input name="contactPerson" />
              </label>
              <label>
                Telefon
                <input name="contactPhone" />
              </label>
              <label className="full">
                Hinweise
                <textarea name="notes" />
              </label>
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Schritt 6: Zusammenfassung</legend>
            <p className="muted">
              Nach dem Absenden berechnet das System den Preis anhand der aktiven
              Preisregeln. Der Admin kann den Preis später manuell überschreiben.
            </p>
          </fieldset>

          <button type="submit">Auftrag erstellen und Zahlung vorbereiten</button>
        </form>
      </section>
    </main>
  );
}
