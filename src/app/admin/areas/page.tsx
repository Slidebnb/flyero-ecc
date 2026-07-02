import Link from "next/link";
import { DistributionAreaStatus, DistributionAreaType, UserRole } from "@prisma/client";
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
};

const AREA_STATUS_LABELS: Record<DistributionAreaStatus, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  DELETED: "Geloescht",
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
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Adminbereich</p>
          <h1>Gebietsmanagement</h1>
        </div>
        <nav className="nav">
          <Link href="/admin/dashboard">Dashboard</Link>
          <Link href="/admin/orders">Auftraege</Link>
          <Link href="/admin/dispatch">Disposition</Link>
        </nav>
      </header>

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
              </div>
              <span className="badge">{area.orders.length} Auftraege</span>
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
                Haushalte
                <input name="estimatedHouseholds" type="number" min="0" defaultValue={area.estimatedHouseholds ?? ""} />
              </label>
              <label>
                Flyer
                <input name="estimatedFlyers" type="number" min="0" defaultValue={area.estimatedFlyers ?? ""} />
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
                polygons: area.polygons.map((polygon) => polygon.geometry),
              }, null, 2)} />
            </details>
          </article>
        ))}
        {areas.length === 0 ? <p className="muted">Keine Gebiete gefunden.</p> : null}
      </section>
    </main>
  );
}
