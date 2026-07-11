import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
﻿import { AreaDataSourceType, DistributionAreaStatus, DistributionAreaType, UserRole } from "@prisma/client";
import { DistributionAreaEditor } from "@/app/components/DistributionAreaEditor";
import { DistributionAreaPreviewMap } from "@/app/components/DistributionAreaPreviewMap";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AREA_TYPE_LABELS: Record<DistributionAreaType, string> = {
  POSTAL_CODE: "PLZ",
  CITY: "Stadt",
  DISTRICT: "Ortsteil",
  POLYGON: "Polygon",
  RADIUS: "Radius",
  CUSTOM: "Individuell",
  DELIVERY_ZONE: "Zustellzone",
};

const AREA_STATUS_LABELS: Record<DistributionAreaStatus, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  DELETED: "Geloescht",
};

const AREA_SOURCE_TYPE_LABELS: Record<AreaDataSourceType, string> = {
  SEED: "Seed/Demo",
  ADMIN: "Admin-Eingabe",
  OFFICIAL: "Amtlich",
  LICENSED: "Lizenziert",
  IMPORTED: "Importiert",
  ESTIMATED: "Geschätzt",
};

type PageProps = {
  searchParams: Promise<{ search?: string; city?: string; type?: DistributionAreaType }>;
};

export default async function AdminAreasPage({ searchParams }: PageProps) {
  await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const params = await searchParams;
  const type = Object.keys(AREA_TYPE_LABELS).includes(params.type ?? "") ? params.type : undefined;
  const areas = await prisma.distributionArea.findMany({
    where: {
      status: { not: "DELETED" },
      ...(type ? { type } : {}),
      ...(params.city ? { city: { contains: params.city, mode: "insensitive" } } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { postalCode: { contains: params.search, mode: "insensitive" } },
              { district: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      polygons: { orderBy: { sortOrder: "asc" } },
      estimates: { orderBy: { createdAt: "desc" }, take: 1 },
      orders: { select: { id: true } },
    },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });
  const areaOptions = areas.map((area) => ({
    id: area.id,
    name: area.name,
    type: area.type,
    city: area.city,
    postalCode: area.postalCode,
    district: area.district,
    estimatedHouseholds: area.estimatedHouseholds,
    estimatedFlyers: area.estimatedFlyers,
    estimatedDistanceMeters: area.estimatedDistanceMeters,
    coverageAreaSqm: area.coverageAreaSqm ? Number(area.coverageAreaSqm) : null,
    geoJson: area.geoJson,
    centerLat: area.centerLat ? Number(area.centerLat) : null,
    centerLng: area.centerLng ? Number(area.centerLng) : null,
    radiusMeters: area.radiusMeters,
  }));

  return (
    <AdminPortalShell eyebrow="Adminbereich" title="Gebietsmanagement">

      <section className="gridCards">
        <article className="card"><strong>{areas.length}</strong><span>Gebiete</span></article>
        <article className="card"><strong>{areas.filter((area) => area.type === "POLYGON").length}</strong><span>Polygone</span></article>
        <article className="card"><strong>{areas.filter((area) => area.type === "POSTAL_CODE").length}</strong><span>PLZ</span></article>
        <article className="card"><strong>{areas.reduce((sum, area) => sum + area.orders.length, 0)}</strong><span>Zuweisungen</span></article>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Gebiet speichern</h2>
        <form action="/api/areas" method="post" className="form grid">
          <label>
            Name
            <input name="name" required placeholder="z.B. Koblenz Metternich" />
          </label>
          <label>
            Stadt
            <input name="city" />
          </label>
          <label>
            PLZ
            <input name="postalCode" />
          </label>
          <label>
            Ortsteil
            <input name="district" />
          </label>
          <label>
            Bundesland
            <input name="state" placeholder="Rheinland-Pfalz" />
          </label>
          <label>
            Land
            <input name="country" defaultValue="DE" />
          </label>
          <label>
            Datenquelle
            <input name="dataSourceName" placeholder="z. B. Admin, Post Direkt, Zensus" />
          </label>
          <label>
            Quellentyp
            <select name="dataSourceType" defaultValue="ADMIN">
              {Object.entries(AREA_SOURCE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Quellen-URL
            <input name="dataSourceUrl" type="url" />
          </label>
          <label>
            Datenstand
            <input name="dataUpdatedAt" type="date" />
          </label>
          <label>
            Confidence 0-1
            <input name="confidence" type="number" min="0" max="1" step="0.001" placeholder="0.700" />
          </label>
          <label className="full">
            Lizenzhinweis
            <textarea name="licenseNote" placeholder="Nutzungsrechte, Lizenz, Einschränkungen" />
          </label>
          <label className="checkbox full">
            <input name="reusable" type="checkbox" value="true" defaultChecked />
            Wiederverwendbar
          </label>
          <div className="full">
            <DistributionAreaEditor areas={areaOptions} />
          </div>
          <button type="submit">Gebiet speichern</button>
        </form>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Filter</h2>
        <form action="/admin/areas" method="get" className="form grid">
          <label>
            Suche
            <input name="search" defaultValue={params.search ?? ""} />
          </label>
          <label>
            Stadt
            <input name="city" defaultValue={params.city ?? ""} />
          </label>
          <label>
            Typ
            <select name="type" defaultValue={type ?? ""}>
              <option value="">Alle</option>
              {Object.entries(AREA_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <button type="submit">Filtern</button>
        </form>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Gebiete verwalten</h2>
        {areas.map((area) => (
          <article className="stack" key={area.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 18 }}>
            <div className="splitHeader">
              <div>
                <strong>{area.name}</strong>
                <p className="muted">
                  {AREA_TYPE_LABELS[area.type]} / {AREA_STATUS_LABELS[area.status]} / {area.city ?? "-"} {area.postalCode ?? ""}
                </p>
                <p className="muted">
                  Quelle: {area.dataSourceName ?? "-"} / {AREA_SOURCE_TYPE_LABELS[area.dataSourceType]} / Stand {area.dataUpdatedAt ? area.dataUpdatedAt.toLocaleDateString("de-DE") : "-"} / Confidence {area.confidence ? Number(area.confidence).toFixed(3) : "-"}
                </p>
              </div>
              <span className="badge">{area.orders.length} Aufträge</span>
            </div>
            <DistributionAreaPreviewMap geoJson={area.geoJson} height={260} />
            <form action={`/api/areas/${area.id}`} method="post" className="form grid">
              <input type="hidden" name="_method" value="PUT" />
              <input type="hidden" name="type" value={area.type} />
              <input type="hidden" name="geoJson" value={JSON.stringify(area.geoJson ?? "")} />
              <label>
                Name
                <input name="name" defaultValue={area.name} required />
              </label>
              <label>
                Stadt
                <input name="city" defaultValue={area.city ?? ""} />
              </label>
              <label>
                PLZ
                <input name="postalCode" defaultValue={area.postalCode ?? ""} />
              </label>
              <label>
                Ortsteil
                <input name="district" defaultValue={area.district ?? ""} />
              </label>
              <label>
                Bundesland
                <input name="state" defaultValue={area.state ?? ""} />
              </label>
              <label>
                Land
                <input name="country" defaultValue={area.country} />
              </label>
              <label>
                Haushalte
                <input name="estimatedHouseholds" type="number" min="0" defaultValue={area.estimatedHouseholds ?? ""} />
              </label>
              <label>
                Flyer
                <input name="estimatedFlyers" type="number" min="0" defaultValue={area.estimatedFlyers ?? ""} />
              </label>
              <label>
                Datenquelle
                <input name="dataSourceName" defaultValue={area.dataSourceName ?? ""} />
              </label>
              <label>
                Quellentyp
                <select name="dataSourceType" defaultValue={area.dataSourceType}>
                  {Object.entries(AREA_SOURCE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                Quellen-URL
                <input name="dataSourceUrl" type="url" defaultValue={area.dataSourceUrl ?? ""} />
              </label>
              <label>
                Datenstand
                <input name="dataUpdatedAt" type="date" defaultValue={area.dataUpdatedAt ? area.dataUpdatedAt.toISOString().slice(0, 10) : ""} />
              </label>
              <label>
                Confidence 0-1
                <input name="confidence" type="number" min="0" max="1" step="0.001" defaultValue={area.confidence ? Number(area.confidence).toString() : ""} />
              </label>
              <label className="full">
                Lizenzhinweis
                <textarea name="licenseNote" defaultValue={area.licenseNote ?? ""} />
              </label>
              <button type="submit">Aenderungen speichern</button>
            </form>
            <div className="actions">
              <form action={`/api/areas/${area.id}`} method="post">
                <input type="hidden" name="action" value="copy" />
                <button type="submit">Kopieren</button>
              </form>
              <form action={`/api/areas/${area.id}`} method="post">
                <input type="hidden" name="_method" value="DELETE" />
                <button type="submit">Deaktivieren</button>
              </form>
            </div>
            <details>
              <summary>Export</summary>
              <textarea readOnly value={JSON.stringify({
                id: area.id,
                name: area.name,
                type: area.type,
                city: area.city,
                postalCode: area.postalCode,
                geoJson: area.geoJson,
                estimatedHouseholds: area.estimatedHouseholds,
                dataSourceName: area.dataSourceName,
                dataSourceType: area.dataSourceType,
                dataSourceUrl: area.dataSourceUrl,
                licenseNote: area.licenseNote,
                dataUpdatedAt: area.dataUpdatedAt,
                confidence: area.confidence,
                polygons: area.polygons.map((polygon) => polygon.geometry),
              }, null, 2)} />
            </details>
          </article>
        ))}
        {areas.length === 0 ? <p className="muted">Keine Gebiete gefunden.</p> : null}
      </section>
    </AdminPortalShell>
  );
}

