import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { CUSTOMER_DOCUMENT_STATUS_LABELS, CUSTOMER_PRINT_STATUS_LABELS, customerOrderName } from "@/app/customer/customerUx";
import { ActionPanel, DataSection, EmptyState, MetricTile, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { createDocument, createPrintOrder, DOCUMENT_TYPE_LABELS, listDocuments, listPrintOrders } from "@/lib/documents";
import { prisma } from "@/lib/prisma";

async function uploadDocument(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.CUSTOMER]);
  await createDocument(session, {
    orderId: String(formData.get("orderId") || ""),
    documentType: String(formData.get("documentType") || "OTHER"),
    title: String(formData.get("title") || ""),
    originalFilename: String(formData.get("originalFilename") || "upload.pdf"),
    mimeType: String(formData.get("mimeType") || "application/pdf"),
    content: String(formData.get("content") || "Flyerdatei wurde für die Prüfung vorgemerkt."),
  });
  redirect("/customer/documents");
}

async function requestPrint(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.CUSTOMER]);
  await createPrintOrder(session, {
    orderId: String(formData.get("orderId") || ""),
    printFormat: String(formData.get("printFormat") || "DIN_A5"),
    paperType: String(formData.get("paperType") || "Bilderdruck"),
    paperWeight: Number(formData.get("paperWeight") || 135),
    colorMode: String(formData.get("colorMode") || "4/4"),
    doubleSided: String(formData.get("doubleSided") || "true") === "true",
    folded: String(formData.get("folded") || "NONE"),
    finishing: String(formData.get("finishing") || "NONE"),
    quantity: Number(formData.get("quantity") || 1000),
    notes: String(formData.get("notes") || ""),
  });
  redirect("/customer/documents");
}

export default async function CustomerDocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireRole([UserRole.CUSTOMER]);
  const params = await searchParams;
  const [documents, printOrders, orders, folders] = await Promise.all([
    listDocuments(session, params),
    listPrintOrders(session),
    prisma.order.findMany({
      where: { customer: { userId: session.id } },
      select: { id: true, orderNumber: true, targetAreaName: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.documentFolder.findMany({
      where: { order: { customer: { userId: session.id } } },
      include: { order: { select: { orderNumber: true } }, _count: { select: { documents: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  const hasOrders = orders.length > 0;

  return (
    <CustomerPortalShell
      active="/customer/documents"
      title="Dateien & Druck"
      description="Flyerdateien hochladen, Druck beauftragen, Freigaben prüfen und fertige Nachweise herunterladen."
    >
      <section className="portalMetrics">
        <MetricTile label="Flyerdateien" value={documents.length} />
        <MetricTile label="In Prüfung" value={documents.filter((item) => item.status === "UNDER_REVIEW").length} tone="warning" />
        <MetricTile label="Freigegeben" value={documents.filter((item) => item.status === "APPROVED").length} tone="success" />
        <MetricTile label="Druckaufträge" value={printOrders.length} />
      </section>

      <div className="customerActionRow">
        <a className="secondaryButton" href="#flyer-upload">Flyerdatei hochladen</a>
        <a className="secondaryButton" href="#print-request">Druck beauftragen</a>
        <a className="secondaryButton" href="#print-status">Druckstatus prüfen</a>
        <a className="secondaryButton" href="#documents-list">Freigaben ansehen</a>
      </div>

      <DataSection title="Suchen & filtern" description="Alles bleibt mit der passenden Kampagne verknüpft.">
        <form className="form grid">
          <label>Suche<input name="q" defaultValue={params.q ?? ""} placeholder="Titel, Datei oder Auftragsnummer" /></label>
          <label>Kampagne<select name="orderId" defaultValue={params.orderId ?? ""}><option value="">Alle Kampagnen</option>{orders.map((order) => <option key={order.id} value={order.id}>{customerOrderName(order.orderNumber)} - {order.targetAreaName}</option>)}</select></label>
          <label>Ordner<select name="folderId" defaultValue={params.folderId ?? ""}><option value="">Alle Ordner</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name} / {customerOrderName(folder.order.orderNumber)}</option>)}</select></label>
          <label>Status<select name="status" defaultValue={params.status ?? ""}><option value="">Alle Status</option>{Object.entries(CUSTOMER_DOCUMENT_STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
          <label>Typ<select name="documentType" defaultValue={params.documentType ?? ""}><option value="">Alle Typen</option>{Object.entries(DOCUMENT_TYPE_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
          <button type="submit">Filtern</button>
        </form>
      </DataSection>

      <div className="portalDashboardGrid">
        <ActionPanel title="Flyerdatei hochladen" description="PDF, Bild oder Druckdatei der richtigen Kampagne zuordnen." id="flyer-upload">
          {hasOrders ? (
            <form action={uploadDocument} className="form">
              <label>Kampagne<select name="orderId" required>{orders.map((order) => <option key={order.id} value={order.id}>{customerOrderName(order.orderNumber)} - {order.targetAreaName}</option>)}</select></label>
              <label>Titel<input name="title" required placeholder="Flyer Vorderseite" /></label>
              <label>Dateiname<input name="originalFilename" required defaultValue="flyer.pdf" /></label>
              <label>Typ<select name="documentType" defaultValue="PRINT_FILE">{Object.entries(DOCUMENT_TYPE_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
              <label>Hinweis<textarea name="content" rows={3} defaultValue="Flyerdatei wurde für die Prüfung vorgemerkt." /></label>
              <button type="submit" disabled={orders.length === 0}>Hochladen</button>
            </form>
          ) : (
            <EmptyState
              title="Erst Kampagne starten"
              description="Druckdaten können hochgeladen werden, sobald eine Kampagne angelegt ist."
              action={{ href: "/customer/orders/new", label: "Neue Kampagne starten" }}
            />
          )}
        </ActionPanel>

        <ActionPanel title="Druck beauftragen" description="FLYERO kann den Druck direkt zur passenden Verteilung einplanen." id="print-request">
          {hasOrders ? (
            <form action={requestPrint} className="form">
              <label>Kampagne<select name="orderId" required>{orders.map((order) => <option key={order.id} value={order.id}>{customerOrderName(order.orderNumber)} - {order.targetAreaName}</option>)}</select></label>
              <label>Format<select name="printFormat" defaultValue="DIN_A5"><option value="DIN_A4">DIN A4</option><option value="DIN_A5">DIN A5</option><option value="DIN_LANG">DIN Lang</option><option value="SQUARE">Quadratisch</option><option value="CUSTOM">Individuell</option></select></label>
              <label>Papier<select name="paperWeight" defaultValue="135">{[90, 115, 135, 170, 250, 300].map((weight) => <option key={weight} value={weight}>{weight}g</option>)}</select></label>
              <label>Farbe<select name="colorMode" defaultValue="4/4"><option>4/4</option><option>4/0</option><option>1/1</option></select></label>
              <label>Veredelung<select name="finishing" defaultValue="NONE"><option value="NONE">Keine</option><option value="VARNISH">Lack</option><option value="MATTE">Matt</option><option value="GLOSS">Glanz</option></select></label>
              <label>Menge<input name="quantity" type="number" min="1" defaultValue="5000" /></label>
              <input type="hidden" name="paperType" value="Bilderdruck" />
              <button type="submit" disabled={orders.length === 0}>Druck anfragen</button>
            </form>
          ) : (
            <EmptyState
              title="Erst Kampagne starten"
              description="Ein Druckauftrag braucht eine Kampagne, damit Menge, Format und Lagerweg sauber zugeordnet werden können."
              action={{ href: "/customer/orders/new", label: "Neue Kampagne starten" }}
            />
          )}
        </ActionPanel>
      </div>

      <DataSection title="Ordner">
        {folders.length ? (
          <div className="portalActions">
            {folders.map((folder) => (
              <a key={folder.id} href={`/customer/documents?folderId=${folder.id}`}>
                {folder.name} · {customerOrderName(folder.order.orderNumber)} · {folder._count.documents}
              </a>
            ))}
          </div>
        ) : (
          <EmptyState title="Noch keine Ordner." description="Kampagnenordner werden automatisch vorbereitet." />
        )}
      </DataSection>

      <DataSection title="Freigaben & Dateien" id="documents-list">
        <div className="tableWrap customerTable">
          <table>
            <thead><tr><th>Titel</th><th>Kampagne</th><th>Typ</th><th>Status</th><th>Version</th><th>Aktion</th></tr></thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td data-label="Titel"><strong>{document.title}</strong><br /><small>{document.originalFilename}</small></td>
                  <td data-label="Kampagne">{customerOrderName(document.order.orderNumber)}</td>
                  <td data-label="Typ">{DOCUMENT_TYPE_LABELS[document.documentType]}</td>
                  <td data-label="Status"><StatusBadge>{CUSTOMER_DOCUMENT_STATUS_LABELS[document.status]}</StatusBadge></td>
                  <td data-label="Version">v{document.version}</td>
                  <td data-label="Aktion"><a className="textLink" href={`/api/customer/documents/${document.id}/download`}>Download</a></td>
                </tr>
              ))}
              {documents.length === 0 ? <tr><td colSpan={6}><EmptyState title="Noch keine Dateien." /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </DataSection>

      <DataSection title="Druckstatus" id="print-status">
        <div className="tableWrap customerTable">
          <table>
            <thead><tr><th>Kampagne</th><th>Status</th><th>Format</th><th>Menge</th><th>Sendung</th></tr></thead>
            <tbody>
              {printOrders.map((printOrder) => (
                <tr key={printOrder.id}>
                  <td data-label="Kampagne">{customerOrderName(printOrder.order.orderNumber)}</td>
                  <td data-label="Status"><StatusBadge>{CUSTOMER_PRINT_STATUS_LABELS[printOrder.status]}</StatusBadge></td>
                  <td data-label="Format">{printOrder.printFormat}</td>
                  <td data-label="Menge">{printOrder.quantity.toLocaleString("de-DE")}</td>
                  <td data-label="Sendung">{printOrder.trackingNumber ?? "Noch nicht versendet"}</td>
                </tr>
              ))}
              {printOrders.length === 0 ? <tr><td colSpan={5}><EmptyState title="Noch keine Druckaufträge." /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
